import { articles, articleTags, db, feeds, feedSyncLogs, feedTags, filterRules } from '@repo/db';
import { sanitizeHtml } from '@repo/readability/sanitize';
import { createId } from '@repo/shared/utils';
import { and, asc, desc, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { autoArchiveArticles } from './archive';
import { shouldMarkAsRead } from './entities/filter-rule';
import { getAutoArchiveCutoffDate } from './entities/settings';
import { logger } from './logger';
import { enqueueFeedSync } from './queues';
import { fetchRss, HttpFetchError, type ParseFeedResult } from './rss-fetch';

// Normalized item structure for our database
interface NormalizedFeedItem {
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

  if (normalizedItems.length === 0) {
    return counts;
  }

  // Batch dedup: query all existing GUIDs at once instead of per-article
  // Scoped to userId so two users subscribing to the same feed each get their own articles
  const guidsToCheck = normalizedItems
    .map((item) => item.guid)
    .filter((guid): guid is string => guid !== null);

  const existingGuids = new Set<string>();
  if (guidsToCheck.length > 0) {
    const existingArticles = await db.query.articles.findMany({
      columns: { guid: true },
      where: and(eq(articles.userId, userId), inArray(articles.guid, guidsToCheck)),
    });
    for (const a of existingArticles) {
      if (a.guid) existingGuids.add(a.guid);
    }
  }

  // Items without GUIDs are always new; items with GUIDs are deduped
  const newItems = normalizedItems.filter(
    (item) => item.guid === null || !existingGuids.has(item.guid),
  );

  if (newItems.length === 0) {
    return counts;
  }

  // Batch filter rules: load once for the entire feed instead of per-article
  const activeRules = await db.query.filterRules.findMany({
    where: and(
      eq(filterRules.userId, userId),
      eq(filterRules.feedId, feedId),
      eq(filterRules.isActive, true),
    ),
  });

  // Batch feed tags: load once instead of per-article
  const feedTagsList = await db.query.feedTags.findMany({
    where: and(eq(feedTags.userId, userId), eq(feedTags.feedId, feedId)),
    columns: { tagId: true },
  });

  for (const item of newItems) {
    try {
      const shouldAutoArchive = item.pubDate < autoArchiveCutoffDate;

      // Evaluate filter rules using pre-loaded rules (pure function, no DB queries)
      const shouldMarkAsReadByRules = shouldMarkAsRead(activeRules, item.title);

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

      // Auto-assign feed tags to the new article using pre-loaded tags
      if (newArticle && feedTagsList.length > 0) {
        await db.insert(articleTags).values(
          feedTagsList.map((ft) => ({
            id: createId(),
            userId,
            articleId: newArticle.id,
            tagId: ft.tagId,
          })),
        );
      }

      counts.created++;
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), {
        feedId,
        guid: item.guid,
        title: item.title?.slice(0, 100),
      });
    }
  }

  return counts;
}

/** Feeds not synced in this many minutes are considered stale */
const OUTDATED_MIN = 15;
/** Max stale feeds enqueued per orchestrator run */
const SYNC_LIMIT = 50;

export interface SyncSingleFeedResult {
  httpStatus: number;
  articlesAdded: number;
}

/**
 * Sync a single feed by ID.
 * Fetches RSS, inserts new articles, updates sync health on the feed row.
 *
 * Returns a result object on success so the worker's `completed` event can write
 * the feed_sync_logs row. Throws FeedSyncError on failure (carries httpStatus +
 * durationMs) so the worker's `failed` event can write the log row.
 *
 * No log writes happen inside this function — all logging is centralised in the
 * worker event handlers to guarantee exactly one log row per attempt.
 */
export async function syncSingleFeed(feedId: string): Promise<SyncSingleFeedResult> {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
  });

  if (!feed) {
    throw new Error(`Feed ${feedId} not found`);
  }

  const userId = feed.userId;

  const fetchResult = await fetchRss(feed.feedUrl, {
    etag: feed.etagHeader,
    lastModified: feed.lastModifiedHeader,
  });

  // 304 Not Modified — feed hasn't changed, just bump lastSyncAt
  if (fetchResult.notModified) {
    await db.update(feeds).set({ lastSyncAt: new Date() }).where(eq(feeds.id, feed.id));
    return { httpStatus: 304, articlesAdded: 0 };
  }

  const autoArchiveCutoffDate = await getAutoArchiveCutoffDate(userId);
  const { created } = await syncFeedArticles(
    fetchResult.feed,
    feed.id,
    userId,
    autoArchiveCutoffDate,
  );

  // Success: reset sync health, update lastSyncAt, and store cache headers
  await db
    .update(feeds)
    .set({
      lastSyncAt: new Date(),
      syncStatus: 'ok',
      syncError: null,
      etagHeader: fetchResult.etag,
      lastModifiedHeader: fetchResult.lastModified,
    })
    .where(eq(feeds.id, feed.id));

  return {
    httpStatus: fetchResult.httpStatus,
    articlesAdded: created,
  };
}

/**
 * Called by the worker's `failed` event on intermediate failures (retries still remaining).
 * Sets syncStatus to 'failing' and writes a feed_sync_logs row.
 */
export async function markFeedAsFailing(
  feedId: string,
  error: Error,
  attemptNumber: number,
  durationMs: number | null,
): Promise<void> {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: { id: true, userId: true },
  });

  if (!feed) return;

  const httpStatus = error instanceof HttpFetchError ? error.status : null;

  await db
    .update(feeds)
    .set({ syncStatus: 'failing', syncError: error.message.slice(0, 1000) })
    .where(eq(feeds.id, feedId));

  await db.insert(feedSyncLogs).values({
    id: createId(),
    userId: feed.userId,
    feedId: feed.id,
    status: 'failed',
    durationMs,
    httpStatus,
    error: `[attempt ${attemptNumber}] ${error.message}`.slice(0, 1000),
    articlesAdded: 0,
  });
}

/**
 * Called by the worker's `failed` event after all BullMQ retry attempts are exhausted.
 * Marks the feed as broken so it is excluded from future orchestrator runs.
 * Writes a feed_sync_logs row for the final attempt.
 * The user can reset a broken feed via forceEnqueueFeedSync which clears syncStatus.
 */
export async function recordFeedSyncFailure(
  feedId: string,
  error: Error,
  attemptNumber: number,
  durationMs: number | null,
): Promise<void> {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: { id: true, userId: true, title: true, feedUrl: true },
  });

  if (!feed) return;

  const httpStatus = error instanceof HttpFetchError ? error.status : null;

  await db
    .update(feeds)
    .set({
      lastSyncAt: new Date(),
      syncStatus: 'broken',
      syncError: error.message.slice(0, 1000),
    })
    .where(eq(feeds.id, feed.id));

  await db.insert(feedSyncLogs).values({
    id: createId(),
    userId: feed.userId,
    feedId: feed.id,
    status: 'failed',
    durationMs,
    httpStatus,
    error: `[attempt ${attemptNumber}] ${error.message}`.slice(0, 1000),
    articlesAdded: 0,
  });

  logger.error(error, {
    operation: 'sync_feed_exhausted',
    feedId: feed.id,
    feedTitle: feed.title,
    feedUrl: feed.feedUrl,
  });
}

/**
 * Called by the worker's `completed` event to write a feed_sync_logs row on success.
 * durationMs is derived by the worker from job.processedOn / job.finishedOn.
 */
export async function writeFeedSyncLog(
  feedId: string,
  result: SyncSingleFeedResult,
  durationMs: number | null,
): Promise<void> {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, feedId),
    columns: { id: true, userId: true },
  });

  if (!feed) return;

  await db.insert(feedSyncLogs).values({
    id: createId(),
    userId: feed.userId,
    feedId: feed.id,
    status: 'ok',
    durationMs,
    httpStatus: result.httpStatus,
    error: null,
    articlesAdded: result.articlesAdded,
  });
}

/**
 * Finds stale feeds across all users and enqueues them for sync.
 * Single global query replaces the old per-user iteration pattern.
 * Broken feeds are excluded. Oldest feeds are prioritized.
 */
export async function enqueueStaleFeeds(): Promise<void> {
  const outdatedDate = new Date(Date.now() - OUTDATED_MIN * 60 * 1000);

  const feedsToSync = await db
    .select({ id: feeds.id })
    .from(feeds)
    .where(
      and(
        ne(feeds.syncStatus, 'broken'),
        or(isNull(feeds.lastSyncAt), lt(feeds.lastSyncAt, outdatedDate)),
      ),
    )
    .orderBy(asc(feeds.lastSyncAt))
    .limit(SYNC_LIMIT);

  if (feedsToSync.length === 0) {
    return;
  }

  console.log(`[SYNC] Enqueueing ${feedsToSync.length} feeds for sync`);

  for (const feed of feedsToSync) {
    await enqueueFeedSync(feed.id);
  }

  console.log(`[SYNC] Successfully enqueued ${feedsToSync.length} feed sync jobs`);
}

/**
 * Returns the sync log history for a feed, newest first.
 * Server-side only — not synced to the client via Electric SQL.
 */
export async function getFeedSyncLogs(userId: string, feedId: string, limit = 50) {
  return db.query.feedSyncLogs.findMany({
    where: and(eq(feedSyncLogs.userId, userId), eq(feedSyncLogs.feedId, feedId)),
    orderBy: desc(feedSyncLogs.createdAt),
    limit,
  });
}

/**
 * Runs auto-archive for all users.
 * NOTE: This still iterates per-user because archive cutoff dates are per-user settings.
 * Acceptable since it runs once daily (not per-minute like sync).
 */
export async function autoArchiveForAllUsers(): Promise<void> {
  const users = await db.query.user.findMany({ columns: { id: true } });

  for (const u of users) {
    await autoArchiveArticles(u.id);
  }
}
