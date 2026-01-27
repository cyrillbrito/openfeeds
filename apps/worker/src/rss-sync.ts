import { articles, articleTags, feeds, feedTags, type UserDb } from '@repo/db';
import {
  enqueueFeedSync,
  evaluateFilterRules,
  fetchRss,
  getAutoArchiveCutoffDate,
  logToFile,
  type ParseFeedResult,
} from '@repo/domain';
import { logger } from '@repo/domain/logger';
import { attemptAsync, createId } from '@repo/shared/utils';
import { eq, isNull, lt, or } from 'drizzle-orm';

// Normalized item structure for our database
export interface NormalizedFeedItem {
  guid: string | null;
  title: string;
  content: string | null;
  description: string | null;
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
      content: item.description || null,
      description: item.description || null,
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
      content: entry.content || null,
      description: entry.summary || null,
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
  db: UserDb,
  autoArchiveCutoffDate?: Date,
): Promise<{
  created: number;
  updated: number;
}> {
  // optional, so when doing many this avoids repeated fetches
  autoArchiveCutoffDate ??= await getAutoArchiveCutoffDate(db);

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
    const shouldMarkAsReadByRules = await evaluateFilterRules(db, feedId, item.title);

    const [newArticle] = await db
      .insert(articles)
      .values({
        id: createId(),
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

/**
 * Sync a single feed by ID.
 * This is the core worker function for individual feed sync jobs.
 */
export async function syncSingleFeed(db: UserDb, feedId: string): Promise<void> {
  const [feedErr, feed] = await attemptAsync(
    db.query.feeds.findFirst({
      where: eq(feeds.id, feedId),
    }),
  );

  if (feedErr) {
    logger.error(feedErr, {
      operation: 'sync_single_feed_fetch',
      feedId,
    });
    throw feedErr;
  }

  if (!feed) {
    console.warn(`Feed ${feedId} not found for sync`);
    return;
  }

  const [feedSyncErr] = await attemptAsync(
    (async () => {
      const feedResult = await fetchRss(feed.feedUrl);
      const autoArchiveCutoffDate = await getAutoArchiveCutoffDate(db);
      await syncFeedArticles(feedResult, feed.id, db, autoArchiveCutoffDate);
    })(),
  );

  if (feedSyncErr) {
    await logToFile('sync', `Feed: ${feed.title}\nError: ${JSON.stringify(feedSyncErr, null, 2)}`);
    logger.error(feedSyncErr, {
      operation: 'sync_feed',
      feedId: feed.id,
      feedTitle: feed.title,
      feedUrl: feed.feedUrl,
    });
  }

  // Always update lastSyncAt regardless of sync success/failure
  const [updateErr] = await attemptAsync(
    db.update(feeds).set({ lastSyncAt: new Date() }).where(eq(feeds.id, feed.id)),
  );
  if (updateErr) {
    console.error(`Failed to update lastSyncAt for feed ${feed.title}:`, updateErr);
    logger.error(updateErr, {
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
export async function syncOldestFeeds(userId: string, db: UserDb): Promise<void> {
  const outdatedDate = new Date(Date.now() - OUTDATED_MIN * 60 * 1000);
  const condition = or(isNull(feeds.lastSyncAt), lt(feeds.lastSyncAt, outdatedDate));

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
