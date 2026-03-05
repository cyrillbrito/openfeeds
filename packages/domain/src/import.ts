import { feeds, feedTags, tags } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';
import { parseOpml } from 'feedsmith';
import { trackEvent } from './analytics';
import type { TransactionContext } from './domain-context';
import { captureException } from './error-tracking';
import { assert, LimitExceededError } from './errors';
import { countUserFeeds, FREE_TIER_LIMITS } from './limits';
import { enqueueFeedDetail, enqueueFeedSync } from './queues';

export interface ImportResult {
  found: number;
  imported: number;
  skipped: number;
  failed: string[];
}

type OPMLOutlines = NonNullable<NonNullable<ReturnType<typeof parseOpml>['body']>['outlines']>;

// Helper function to get feeds from OPML outlines recursively
function getFeedsFromOutlines(outlines: OPMLOutlines): Array<{
  title: string;
  xmlUrl: string;
  htmlUrl: string;
  category?: string;
}> {
  const feedsList: Array<{
    title: string;
    xmlUrl: string;
    htmlUrl: string;
    category?: string;
  }> = [];

  for (const outline of outlines) {
    // If this outline has xmlUrl, it's a feed
    if (outline.xmlUrl) {
      feedsList.push({
        title: outline.title || outline.text || 'Unknown Feed',
        xmlUrl: outline.xmlUrl,
        htmlUrl: outline.htmlUrl || outline.xmlUrl,
        category: outline.category,
      });
    }

    // Recursively check nested outlines
    if (outline.outlines) {
      const nestedFeeds = getFeedsFromOutlines(outline.outlines);
      // If this outline doesn't have xmlUrl but has nested feeds, it's likely a category
      const categoryName = outline.text || outline.title;
      feedsList.push(
        ...nestedFeeds.map((feed) => ({
          ...feed,
          category: feed.category || categoryName,
        })),
      );
    }
  }

  return feedsList;
}

// Core business logic for importing OPML feeds
export async function importOpmlFeeds(
  ctx: TransactionContext,
  opmlContent: string,
): Promise<ImportResult> {
  const parsedOpml = parseOpml(opmlContent);

  // Extract all feeds from the OPML structure
  const feedsToImport = getFeedsFromOutlines(parsedOpml.body?.outlines || []);

  // Check free-tier feed limit: count existing feeds, deduplicate against OPML, and verify the new ones fit
  const currentFeedCount = await countUserFeeds(ctx.userId, ctx.conn);

  const opmlUrls = feedsToImport.map((f) => f.xmlUrl);
  const existingFeedUrls = new Set(
    (
      await ctx.conn.query.feeds.findMany({
        where: and(inArray(feeds.feedUrl, opmlUrls), eq(feeds.userId, ctx.userId)),
        columns: { feedUrl: true },
      })
    ).map((f) => f.feedUrl),
  );
  const newFeedCount = feedsToImport.filter((f) => !existingFeedUrls.has(f.xmlUrl)).length;
  const remainingSlots = FREE_TIER_LIMITS.feeds - currentFeedCount;

  if (newFeedCount > remainingSlots) {
    trackEvent(ctx.userId, 'limits:feeds_limit_hit', {
      source: 'opml_import',
      current_usage: currentFeedCount,
      limit: FREE_TIER_LIMITS.feeds,
    });
    throw new LimitExceededError('feeds', FREE_TIER_LIMITS.feeds);
  }

  let imported = 0;
  let skipped = 0;
  const failed: string[] = [];

  // Prefetch all tags for this user
  const existingTags = await ctx.conn.query.tags.findMany({
    where: eq(tags.userId, ctx.userId),
    columns: { id: true, name: true },
  });

  const tagLookup = existingTags.reduce<Record<string, string>>((obj, tag) => {
    obj[tag.name] = tag.id;
    return obj;
  }, {});

  for (const feed of feedsToImport) {
    try {
      // Parse comma-separated categories per OPML 2.0 spec
      const tagIds: string[] = [];
      if (feed.category) {
        const categories = feed.category
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
        for (const category of categories) {
          let tagId = tagLookup[category];

          if (!tagId) {
            try {
              const tagResult = await ctx.conn
                .insert(tags)
                .values({ userId: ctx.userId, name: category })
                .returning();
              tagId = tagResult[0]?.id;
              assert(tagId);
              tagLookup[category] = tagId;
            } catch (tagErr) {
              console.error(tagErr, {
                operation: 'import_tag_creation',
                tagName: category,
              });
              // Continue with other categories, don't fail the whole feed
              continue;
            }
          }
          tagIds.push(tagId);
        }
      }

      // Check if feed already exists (by feedUrl for this user) — skip if so
      const existingFeed = await ctx.conn.query.feeds.findFirst({
        where: and(eq(feeds.feedUrl, feed.xmlUrl), eq(feeds.userId, ctx.userId)),
        columns: { id: true },
      });

      if (existingFeed) {
        skipped++;
        continue;
      }

      const insertResult = await ctx.conn
        .insert(feeds)
        .values({
          userId: ctx.userId,
          title: feed.title,
          url: feed.htmlUrl,
          feedUrl: feed.xmlUrl,
        })
        .returning();

      const id = insertResult[0]?.id;
      assert(id);

      if (tagIds.length > 0) {
        await ctx.conn.insert(feedTags).values(
          tagIds.map((tagId) => ({
            userId: ctx.userId,
            feedId: id,
            tagId,
          })),
        );
      }

      ctx.afterCommit(() => enqueueFeedSync(ctx.userId, id));
      ctx.afterCommit(() => enqueueFeedDetail(ctx.userId, id));

      imported++;
    } catch (error) {
      console.error(error, {
        operation: 'import_feed',
        feedTitle: feed.title,
        feedUrl: feed.xmlUrl,
      });
      captureException(error as Error, {
        operation: 'import_feed',
        feedTitle: feed.title,
        feedUrl: feed.xmlUrl,
      });
      failed.push(feed.title);
    }
  }

  // Track OPML import (server-side for reliability)
  if (imported > 0) {
    trackEvent(ctx.userId, 'feeds:opml_import', {
      feed_count: imported,
      tag_count: Object.keys(tagLookup).length - existingTags.length, // New tags created
      failed_count: failed.length,
    });
  }

  return {
    found: feedsToImport.length,
    imported,
    skipped,
    failed,
  };
}
