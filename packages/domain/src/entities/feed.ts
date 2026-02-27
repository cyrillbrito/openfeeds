import { db, feeds, type DbFeed, type DbInsertFeed } from '@repo/db';
import { discoverFeeds } from '@repo/discovery/server';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { BadRequestError, LimitExceededError, NotFoundError } from '../errors';
import { countUserFeeds, FREE_TIER_LIMITS } from '../limits';
import { enqueueFeedDetail, enqueueFeedSync } from '../queues';
import type { CreateFeed, DiscoveredFeed, Feed, UpdateFeed } from './feed.schema';

// Re-export schemas and types from schema file
export * from './feed.schema';

function toApiFeed(f: DbFeed): Feed {
  return {
    id: f.id,
    userId: f.userId,
    url: f.url,
    feedUrl: f.feedUrl,
    title: f.title,
    description: f.description,
    icon: f.icon,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    lastSyncAt: f.lastSyncAt?.toISOString() ?? null,
    syncStatus: f.syncStatus as Feed['syncStatus'],
    syncError: f.syncError,
  };
}

/** Existence + ownership guard. Throws NotFoundError if feed doesn't exist or doesn't belong to user. */
async function assertFeedExists(id: string, userId: string): Promise<void> {
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, id), eq(feeds.userId, userId)),
    columns: { id: true },
  });

  if (!feed) {
    throw new NotFoundError();
  }
}

export async function createFeeds(data: CreateFeed[], userId: string): Promise<Feed[]> {
  if (data.length === 0) return [];

  // Check free-tier feed limit
  const currentCount = await countUserFeeds(userId);
  if (currentCount + data.length > FREE_TIER_LIMITS.feeds) {
    trackEvent(userId, 'limits:feeds_limit_hit', {
      source: 'create',
      current_usage: currentCount,
      limit: FREE_TIER_LIMITS.feeds,
    });
    throw new LimitExceededError('feeds', FREE_TIER_LIMITS.feeds);
  }

  const values: DbInsertFeed[] = data.map((item) => ({
    id: item.id ?? createId(),
    userId,
    title: 'Unknown',
    description: '',
    url: item.url,
    feedUrl: item.url,
    lastSyncAt: null,
    createdAt: undefined,
  }));

  // NOTE: Duplicates are silently skipped via ON CONFLICT DO NOTHING.
  // The client already prevents following feeds the user already has, so conflicts
  // here are a race-condition safety net. We may want to revisit this and surface
  // skipped feeds to the caller if it causes confusion down the line.
  const inserted = await db
    .insert(feeds)
    .values(values)
    .onConflictDoNothing({ target: [feeds.userId, feeds.feedUrl] })
    .returning();

  // Enqueue workers for all newly created feeds
  await Promise.all(
    inserted.map(async (feed) => {
      await enqueueFeedDetail(userId, feed.id);
      await enqueueFeedSync(feed.id);
    }),
  );

  // Track feed creations
  for (const feed of inserted) {
    trackEvent(userId, 'feeds:feed_create', {
      feed_id: feed.id,
      feed_url: feed.feedUrl,
    });
  }

  return inserted.map(toApiFeed);
}

export async function updateFeeds(data: UpdateFeed[], userId: string): Promise<void> {
  if (data.length === 0) return;

  await db.transaction(async (tx) => {
    for (const { id, ...updates } of data) {
      const feedUpdateData: Record<string, unknown> = {};
      if (updates.title !== undefined) feedUpdateData.title = updates.title;
      if (updates.description !== undefined) feedUpdateData.description = updates.description;
      if (updates.url !== undefined) feedUpdateData.url = updates.url;
      if (updates.icon !== undefined) feedUpdateData.icon = updates.icon;

      if (Object.keys(feedUpdateData).length > 0) {
        await tx
          .update(feeds)
          .set(feedUpdateData)
          .where(and(eq(feeds.id, id), eq(feeds.userId, userId)));
      }
    }
  });
}

export async function deleteFeeds(ids: string[], userId: string): Promise<void> {
  if (ids.length === 0) return;

  await db.delete(feeds).where(and(inArray(feeds.id, ids), eq(feeds.userId, userId)));

  for (const id of ids) {
    trackEvent(userId, 'feeds:feed_delete', { feed_id: id });
  }
}

/**
 * Reset a feed's sync error state so the orchestrator picks it up again.
 * Does NOT immediately sync — the next orchestrator run will handle it.
 */
export async function retryFeed(id: string, userId: string): Promise<void> {
  // Verify feed exists and belongs to user
  await assertFeedExists(id, userId);

  await db
    .update(feeds)
    .set({
      syncStatus: 'ok',
      syncError: null,
    })
    .where(and(eq(feeds.id, id), eq(feeds.userId, userId)));
}

export async function discoverRssFeeds(url: string): Promise<DiscoveredFeed[]> {
  try {
    return await discoverFeeds(url);
  } catch (error) {
    console.error('Discovery failed:', error);
    throw new BadRequestError(`Failed to discover feeds: ${String(error)}`);
  }
}
