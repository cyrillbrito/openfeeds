import { db, feeds, type DbFeed, type DbInsertFeed } from '@repo/db';
import { discoverFeeds } from '@repo/discovery/server';
import { createId } from '@repo/shared/utils';
import { and, eq } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { assert, BadRequestError, ConflictError, NotFoundError } from '../errors';
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

export async function createFeed(data: CreateFeed, userId: string): Promise<Feed> {
  // Check if feed with this URL already exists for this user
  const existingFeed = await db.query.feeds.findFirst({
    where: and(eq(feeds.feedUrl, data.url), eq(feeds.userId, userId)),
  });

  if (existingFeed) {
    throw new ConflictError('Feed with this URL already exists');
  }

  const feedId = data.id ?? createId();
  const feed: DbInsertFeed = {
    id: feedId,
    userId,
    title: 'Unknown',
    description: '',
    url: data.url,
    feedUrl: data.url,
    lastSyncAt: null,
    createdAt: undefined,
  };

  const dbResult = await db.insert(feeds).values(feed).returning();

  const newFeed = dbResult[0];
  assert(newFeed, 'Created feed must exist');

  // Enqueue for worker to fetch metadata and sync articles
  await enqueueFeedDetail(userId, feedId);
  await enqueueFeedSync(feedId);

  // Track feed creation (server-side for reliability)
  trackEvent(userId, 'feeds:feed_create', {
    feed_id: feedId,
    feed_url: data.url,
    source: 'manual',
  });

  return toApiFeed(newFeed);
}

export async function updateFeed(id: string, data: UpdateFeed, userId: string): Promise<void> {
  // Verify feed exists and belongs to user
  await assertFeedExists(id, userId);

  const feedUpdateData = {
    title: data.title,
    description: data.description,
    url: data.url,
    icon: data.icon,
  };

  Object.keys(feedUpdateData).forEach((key) => {
    if (feedUpdateData[key as keyof typeof feedUpdateData] === undefined) {
      delete feedUpdateData[key as keyof typeof feedUpdateData];
    }
  });

  if (Object.keys(feedUpdateData).length > 0) {
    await db
      .update(feeds)
      .set(feedUpdateData)
      .where(and(eq(feeds.id, id), eq(feeds.userId, userId)));
  }
}

export async function deleteFeed(id: string, userId: string): Promise<void> {
  await assertFeedExists(id, userId);

  await db.delete(feeds).where(and(eq(feeds.id, id), eq(feeds.userId, userId)));

  trackEvent(userId, 'feeds:feed_delete', {
    feed_id: id,
  });
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
