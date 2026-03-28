import { feeds, feedTags, tags } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';
import { parseOpml } from 'feedsmith';
import { trackEvent } from './analytics';
import type { TransactionContext } from './domain-context';
import { feedUrlSchema } from './entities/feed.schema';
import { captureException } from './error-tracking';
import { assert } from './errors';
import { checkFeedLimit } from './limits';
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

  // Extract all feeds from the OPML structure, filtering out entries with invalid URLs
  const allFeeds = getFeedsFromOutlines(parsedOpml.body?.outlines || []);
  const feedsToImport: typeof allFeeds = [];
  const failed: string[] = [];

  for (const feed of allFeeds) {
    if (feedUrlSchema.safeParse(feed.xmlUrl).success) {
      feedsToImport.push(feed);
    } else {
      failed.push(feed.title);
    }
  }

  // Deduplicate OPML feeds against existing subscriptions, then check the plan limit
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

  await checkFeedLimit(ctx, newFeedCount, 'opml_import');

  let imported = 0;
  let skipped = 0;

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
      // Each feed runs in a savepoint so a DB error on one feed doesn't poison
      // the outer transaction and roll back previously-imported feeds.
      const feedId = await ctx.conn.transaction(async (sp) => {
        // Check existence first — before tag creation — so a rollback for an
        // already-existing feed doesn't leave stale IDs in the shared tagLookup.
        const existingFeed = await sp.query.feeds.findFirst({
          where: and(eq(feeds.feedUrl, feed.xmlUrl), eq(feeds.userId, ctx.userId)),
          columns: { id: true },
        });

        if (existingFeed) {
          return null;
        }

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
              const tagResult = await sp
                .insert(tags)
                .values({ userId: ctx.userId, name: category })
                .returning();
              tagId = tagResult[0]?.id;
              assert(tagId);
              tagLookup[category] = tagId;
            }
            tagIds.push(tagId);
          }
        }

        const insertResult = await sp
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
          await sp.insert(feedTags).values(
            tagIds.map((tagId) => ({
              userId: ctx.userId,
              feedId: id,
              tagId,
            })),
          );
        }

        return id;
      });

      if (feedId === null) {
        skipped++;
        continue;
      }

      ctx.afterCommit(() => enqueueFeedSync(ctx.userId, feedId));
      ctx.afterCommit(() => enqueueFeedDetail(ctx.userId, feedId));

      imported++;
    } catch (error) {
      console.error(error, {
        operation: 'import_feed',
        feedTitle: feed.title,
        feedUrl: feed.xmlUrl,
      });
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion
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
    found: allFeeds.length,
    imported,
    skipped,
    failed,
  };
}
