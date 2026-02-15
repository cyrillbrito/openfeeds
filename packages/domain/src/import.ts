import { db, feeds, feedTags, tags } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { eq } from 'drizzle-orm';
import { parseOpml } from 'feedsmith';
import { trackEvent } from './analytics';
import { assert } from './errors';
import { logger } from './logger';
import { enqueueFeedDetail, enqueueFeedSync } from './queues';

export interface ImportResult {
  imported: number;
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
  const feeds: Array<{
    title: string;
    xmlUrl: string;
    htmlUrl: string;
    category?: string;
  }> = [];

  for (const outline of outlines) {
    // If this outline has xmlUrl, it's a feed
    if (outline.xmlUrl) {
      feeds.push({
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
      feeds.push(
        ...nestedFeeds.map((feed) => ({
          ...feed,
          category: feed.category || categoryName,
        })),
      );
    }
  }

  return feeds;
}

// Core business logic for importing OPML feeds
export async function importOpmlFeeds(opmlContent: string, userId: string): Promise<ImportResult> {
  const parsedOpml = parseOpml(opmlContent);

  // Extract all feeds from the OPML structure
  const feedsToImport = getFeedsFromOutlines(parsedOpml.body?.outlines || []);

  let imported = 0;
  let _skipped = 0;
  const failed: string[] = [];

  // Prefetch all tags
  const existingTags = await db.query.tags.findMany({
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
              const tagResult = await db
                .insert(tags)
                .values({ id: createId(), userId, name: category })
                .returning();
              tagId = tagResult[0]?.id;
              assert(tagId);
              tagLookup[category] = tagId;
            } catch (tagErr) {
              logger.error(tagErr as Error, {
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

      // Check if feed already exists (by feedUrl) — skip if so
      const existingFeed = await db.query.feeds.findFirst({
        where: eq(feeds.feedUrl, feed.xmlUrl),
        columns: { id: true },
      });

      if (existingFeed) {
        _skipped++;
        continue;
      }

      const insertResult = await db
        .insert(feeds)
        .values({
          id: createId(),
          userId,
          title: feed.title,
          url: feed.htmlUrl,
          feedUrl: feed.xmlUrl,
        })
        .returning();

      const feedId = insertResult[0]?.id;
      assert(feedId);

      if (tagIds.length > 0) {
        try {
          await db.insert(feedTags).values(
            tagIds.map((tagId) => ({
              id: createId(),
              userId,
              feedId,
              tagId,
            })),
          );
        } catch (feedTagErr) {
          logger.error(feedTagErr as Error, {
            operation: 'import_feed_tag_association',
            feedTitle: feed.title,
            feedId,
            tagIds,
          });
        }
      }

      try {
        await enqueueFeedSync(userId, feedId);
      } catch (enqueueError) {
        logger.error(enqueueError as Error, {
          operation: 'import_feed_enqueue_sync',
          feedTitle: feed.title,
          feedUrl: feed.xmlUrl,
        });
      }

      try {
        await enqueueFeedDetail(userId, feedId);
      } catch (enqueueError) {
        logger.error(enqueueError as Error, {
          operation: 'import_feed_detail_enqueue',
          feedTitle: feed.title,
          feedUrl: feed.xmlUrl,
        });
      }

      imported++;
    } catch (error) {
      logger.error(error as Error, {
        operation: 'import_feed',
        feedTitle: feed.title,
        feedUrl: feed.xmlUrl,
      });
      failed.push(feed.title);
    }
  }

  // Track OPML import (server-side for reliability)
  if (imported > 0) {
    trackEvent(userId, 'feeds:opml_import', {
      feed_count: imported,
      tag_count: Object.keys(tagLookup).length - existingTags.length, // New tags created
      failed_count: failed.length,
    });
  }

  return {
    imported,
    failed,
  };
}
