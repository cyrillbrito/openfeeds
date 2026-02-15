import { articles, articleTags, db, feeds, feedTags, filterRules } from '@repo/db';
import { sanitizeHtml } from '@repo/readability/sanitize';
import { createId } from '@repo/shared/utils';
import { and, asc, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { autoArchiveArticles } from './archive';
import { filterRuleDbToApi } from './db-utils';
import { shouldMarkAsRead } from './entities/filter-rule';
import { getAutoArchiveCutoffDate } from './entities/settings';
import { logger } from './logger';
import { enqueueFeedSync } from './queues';
import { fetchRss, type ParseFeedResult } from './rss-fetch';

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
  const guidsToCheck = normalizedItems
    .map((item) => item.guid)
    .filter((guid): guid is string => guid !== null);

  const existingGuids = new Set<string>();
  if (guidsToCheck.length > 0) {
    const existingArticles = await db.query.articles.findMany({
      columns: { guid: true },
      where: inArray(articles.guid, guidsToCheck),
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
    where: and(eq(filterRules.feedId, feedId), eq(filterRules.isActive, true)),
  });
  const apiRules = activeRules.map(filterRuleDbToApi);

  // Batch feed tags: load once instead of per-article
  const feedTagsList = await db.query.feedTags.findMany({
    where: eq(feedTags.feedId, feedId),
    columns: { tagId: true },
  });

  for (const item of newItems) {
    const shouldAutoArchive = item.pubDate < autoArchiveCutoffDate;

    // Evaluate filter rules using pre-loaded rules (pure function, no DB queries)
    const shouldMarkAsReadByRules = shouldMarkAsRead(apiRules, item.title);

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
  }

  return counts;
}

/** Feeds not synced in this many minutes are considered stale */
const OUTDATED_MIN = 10;
/** Max stale feeds enqueued per orchestrator run */
const SYNC_LIMIT = 50;
/** Consecutive sync failures before a feed is marked as broken and excluded from sync */
const BROKEN_THRESHOLD = 3;

/**
 * Sync a single feed by ID.
 * Fetches RSS, inserts new articles, tracks sync health (ok/failing/broken).
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
 * Finds stale feeds across all users and enqueues them for sync.
 * Single global query replaces the old per-user iteration pattern.
 * Broken feeds are excluded. Oldest feeds are prioritized.
 */
export async function enqueueStaleFeeds(): Promise<void> {
  const outdatedDate = new Date(Date.now() - OUTDATED_MIN * 60 * 1000);

  const feedsToSync = await db
    .select({ id: feeds.id, userId: feeds.userId })
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
    await enqueueFeedSync(feed.userId, feed.id);
  }

  console.log(`[SYNC] Successfully enqueued ${feedsToSync.length} feed sync jobs`);
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
