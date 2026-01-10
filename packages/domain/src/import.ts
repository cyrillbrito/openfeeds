import { feeds, feedTags, tags, type UserDb } from '@repo/db';
import { type ImportResult } from '@repo/shared/types';
import { attemptAsync, createId } from '@repo/shared/utils';
import { eq } from 'drizzle-orm';
import { parseOpml } from 'feedsmith';
import { assert } from './errors';
import { logger } from './logger';
import { enqueueFeedDetail, enqueueFeedSync } from './queues';

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
export async function importOpmlFeeds(
  opmlContent: string,
  userId: string,
  db: UserDb,
): Promise<ImportResult> {
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
      let tagId: string | undefined;
      if (feed.category) {
        tagId = tagLookup[feed.category];

        if (!tagId) {
          const [tagErr, tagResult] = await attemptAsync(
            db.insert(tags).values({ id: createId(), name: feed.category }).returning(),
          );
          if (tagErr) {
            logger.error(tagErr, {
              operation: 'import_tag_creation',
              tagName: feed.category,
            });
            failed.push(feed.title);
            continue;
          }
          tagId = tagResult[0]?.id;
          assert(tagId);
          tagLookup[feed.category] = tagId;
        }
      }

      // Check if feed already exists (by feedUrl)
      const [existingFeedErr, existingFeed] = await attemptAsync(
        db.query.feeds.findFirst({
          where: eq(feeds.feedUrl, feed.xmlUrl),
          columns: { id: true },
        }),
      );

      if (existingFeedErr) {
        logger.error(existingFeedErr, {
          operation: 'import_check_existing_feed',
          feedTitle: feed.title,
          feedUrl: feed.xmlUrl,
        });
        failed.push(feed.title);
        continue;
      }

      if (existingFeed) {
        _skipped++;
        continue;
      }

      const [insertErr, insertResult] = await attemptAsync(
        db
          .insert(feeds)
          .values({
            id: createId(),
            title: feed.title,
            url: feed.htmlUrl,
            feedUrl: feed.xmlUrl,
          })
          .returning(),
      );

      if (insertErr) {
        logger.error(insertErr, {
          operation: 'import_insert_feed',
          feedTitle: feed.title,
          feedUrl: feed.xmlUrl,
        });
        failed.push(feed.title);
        continue;
      }

      const feedId = insertResult[0]?.id;
      assert(feedId);

      if (tagId) {
        const [feedTagErr] = await attemptAsync(
          db.insert(feedTags).values([
            {
              id: createId(),
              feedId: feedId,
              tagId: tagId,
            },
          ]),
        );

        if (feedTagErr) {
          logger.error(feedTagErr, {
            operation: 'import_feed_tag_association',
            feedTitle: feed.title,
            feedId: feedId,
            tagId: tagId,
          });
        }
      }

      const [enqueueError] = await attemptAsync(enqueueFeedSync(userId, feedId));

      if (enqueueError) {
        logger.error(enqueueError, {
          operation: 'import_feed_enqueue_sync',
          feedTitle: feed.title,
          feedUrl: feed.xmlUrl,
        });
      }

      const [enqueueError2] = await attemptAsync(enqueueFeedDetail(userId, feedId));

      if (enqueueError2) {
        logger.error(enqueueError2, {
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

  return {
    imported,
    failed,
  };
}
