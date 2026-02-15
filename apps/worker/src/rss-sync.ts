import { articles, articleTags, db, feeds, feedTags } from '@repo/db';
import {
  enqueueFeedSync,
  evaluateFilterRules,
  fetchRss,
  getAutoArchiveCutoffDate,
  type ParseFeedResult,
} from '@repo/domain';
import { logger } from '@repo/domain/logger';
import { sanitizeHtml } from '@repo/readability/sanitize';
import { createId } from '@repo/shared/utils';
import { and, eq, isNull, lt, ne, or } from 'drizzle-orm';

// Normalized item structure for our database
export interface NormalizedFeedItem {
  guid: string | null;
  title: string;
  content: string | null | undefined;
  description: string | null | undefined;
  url: string | null;
  pubDate: Date;
  author: string | null;
}

function getNormalizedItems(feedResult: ParseFeedResult): NormalizedFeedItem[] {
  if (feedResult.format === 'rss') {
    const items = feedResult.feed.items || [];
    return items.map((item) => ({
      guid: item.guid?.value || null,
      title: item.title || '',
      content: sanitizeHtml(item.description),
      description: sanitizeHtml(item.description),
      url: item.link || null,
      pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
      author:
        Array.isArray(item.authors) && item.authors.length > 0 ? item.authors[0] || null : null,
    }));
  } else if (feedResult.format === 'atom') {
    const entries = feedResult.feed.entries || [];
    return entries.map((entry) => ({
      guid: entry.id || null,
      title: entry.title || '',
      content: sanitizeHtml(entry.content),
      description: sanitizeHtml(entry.summary),
      url: entry.links?.find((link) => link.rel !== 'self')?.href || null,
      pubDate: entry.published
        ? new Date(entry.published)
        : entry.updated
          ? new Date(entry.updated)
          : new Date(),
      author:
        Array.isArray(entry.authors) && entry.authors.length > 0
          ? entry.authors[0]?.name || null
          : null,
    }));
  }

  // TODO Handle other formats (json, rdf) - basic fallback
  return [];
}

/**
 * Syncs feed articles from the parsed feed result.
 * Old articles (based on autoArchiveCutoffDate) are automatically archived.
 * Filter rules can mark articles as read regardless of age.
 */
export async function syncFeedArticles(
  feedResult: ParseFeedResult,
  feedId: string,
  userId: string,
  autoArchiveCutoffDate?: Date,
): Promise<{
  created: number;
  updated: number;
}> {
  // optional, so when doing many this avoids repeated fetches
  autoArchiveCutoffDate ??= await getAutoArchiveCutoffDate(userId);

  const counts = {
    created: 0,
    updated: 0,
  };

  // Get items based on feed format and normalize them
  const normalizedItems = getNormalizedItems(feedResult);

  // Note: Content extraction is now done on-demand when user views the article
  // This significantly reduces memory/CPU usage during feed sync

  for (const item of normalizedItems) {
    if (!item.guid) continue;

    const existing = await db.query.articles.findFirst({
      columns: { id: true },
      where: eq(articles.guid, item.guid),
    });

    if (existing) {
      continue;
    }

    const shouldAutoArchive = item.pubDate < autoArchiveCutoffDate;

    // Apply filter rules to determine if article should be marked as read
    const shouldMarkAsReadByRules = await evaluateFilterRules(feedId, item.title, userId);

    const [newArticle] = await db
      .insert(articles)
      .values({
        id: createId(),
        userId,
        feedId: feedId,
        guid: item.guid,
        title: item.title,
        content: item.content,
        description: item.description,
        url: item.url,
        pubDate: item.pubDate,
        author: item.author,
        isRead: shouldMarkAsReadByRules,
        isArchived: shouldAutoArchive,
        // cleanContent is null - will be extracted on-demand when user views the article
        cleanContent: null,
      })
      .returning({ id: articles.id });

    // Auto-assign feed tags to the new article
    if (newArticle) {
      const feedTagsList = await db.query.feedTags.findMany({
        where: eq(feedTags.feedId, feedId),
        columns: {
          tagId: true,
        },
      });

      if (feedTagsList.length > 0) {
        await db.insert(articleTags).values(
          feedTagsList.map((ft) => ({
            id: createId(),
            userId,
            articleId: newArticle.id,
            tagId: ft.tagId,
          })),
        );
      }
    }

    counts.created++;
  }

  return counts;
}

const OUTDATED_MIN = 10;
const LIMIT = 15;
/** Number of consecutive failures before a feed is marked as broken */
const BROKEN_THRESHOLD = 3;

/**
 * Sync a single feed by ID.
 * This is the core worker function for individual feed sync jobs.
 */
export async function syncSingleFeed(userId: string, feedId: string): Promise<void> {
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });

  if (!feed) {
    console.warn(`Feed ${feedId} not found for sync`);
    return;
  }

  try {
    const feedResult = await fetchRss(feed.feedUrl);
    const autoArchiveCutoffDate = await getAutoArchiveCutoffDate(userId);
    await syncFeedArticles(feedResult, feed.id, userId, autoArchiveCutoffDate);
  } catch (err) {
    const feedSyncErr = err instanceof Error ? err : new Error(String(err));
    logger.error(feedSyncErr, {
      operation: 'sync_feed',
      feedId: feed.id,
      feedTitle: feed.title,
      feedUrl: feed.feedUrl,
    });

    // Track the failure: increment count and update status
    const newFailCount = feed.syncFailCount + 1;
    const newStatus = newFailCount >= BROKEN_THRESHOLD ? 'broken' : 'failing';

    try {
      await db
        .update(feeds)
        .set({
          lastSyncAt: new Date(),
          syncStatus: newStatus,
          syncFailCount: newFailCount,
          syncError: feedSyncErr.message.slice(0, 1000),
        })
        .where(eq(feeds.id, feed.id));
    } catch (updateErr) {
      logger.error(updateErr instanceof Error ? updateErr : new Error(String(updateErr)), {
        operation: 'update_feed_sync_failure',
        feedId: feed.id,
        feedTitle: feed.title,
      });
    }
    return;
  }

  // Success: reset sync health and update lastSyncAt
  try {
    await db
      .update(feeds)
      .set({
        lastSyncAt: new Date(),
        syncStatus: 'ok',
        syncFailCount: 0,
        syncError: null,
      })
      .where(eq(feeds.id, feed.id));
  } catch (updateErr) {
    logger.error(updateErr instanceof Error ? updateErr : new Error(String(updateErr)), {
      operation: 'update_feed_sync_time',
      feedId: feed.id,
      feedTitle: feed.title,
    });
  }
}

/**
 * Finds feeds that need syncing and enqueues them as individual jobs.
 * This is the orchestrator job that runs on a schedule.
 */
export async function syncOldestFeeds(userId: string): Promise<void> {
  const outdatedDate = new Date(Date.now() - OUTDATED_MIN * 60 * 1000);
  const condition = and(
    eq(feeds.userId, userId),
    ne(feeds.syncStatus, 'broken'),
    or(isNull(feeds.lastSyncAt), lt(feeds.lastSyncAt, outdatedDate)),
  );

  // TODO Include fields
  const feedsToSync = await db.select().from(feeds).where(condition).limit(LIMIT);

  if (feedsToSync.length === 0) {
    return;
  }

  console.log(`[SYNC] Enqueueing ${feedsToSync.length} feeds for user ${userId}`);

  // Enqueue each feed as a separate job
  for (const feed of feedsToSync) {
    await enqueueFeedSync(userId, feed.id);
  }

  console.log(`[SYNC] Successfully enqueued ${feedsToSync.length} feed sync jobs`);
}
