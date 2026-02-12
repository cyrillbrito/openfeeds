import { feeds, getDb, type DbInsertFeed } from '@repo/db';
import { discoverFeeds } from '@repo/discovery/server';
import { attemptAsync, createId } from '@repo/shared/utils';
import { and, eq } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { feedDbToApi } from '../db-utils';
import { assert, BadRequestError, ConflictError, NotFoundError, UnexpectedError } from '../errors';
import { enqueueFeedDetail, enqueueFeedSync } from '../queues';
import type { CreateFeed, DiscoveredFeed, Feed, UpdateFeed } from './feed.schema';

// Re-export schemas and types from schema file
export * from './feed.schema';

export async function getAllFeeds(userId: string): Promise<Feed[]> {
  const db = getDb();
  const allFeeds = await db.query.feeds.findMany({
    where: eq(feeds.userId, userId),
  });

  return allFeeds.map(feedDbToApi);
}

/**
 * Get feed by ID
 * Used for business logic that needs a single feed
 */
export async function getFeedById(id: string, userId: string): Promise<Feed> {
  const db = getDb();
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, id), eq(feeds.userId, userId)),
  });

  if (!feed) {
    throw new NotFoundError();
  }

  return feedDbToApi(feed);
}

export async function createFeed(
  data: CreateFeed & { id?: string },
  userId: string,
): Promise<Feed> {
  const db = getDb();
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

  const [err, dbResult] = await attemptAsync(db.insert(feeds).values(feed).returning());

  if (err) {
    // TODO Better drizzle error handling
    console.error('Database error creating feed:', err);
    throw new UnexpectedError();
  }

  const newFeed = dbResult[0];
  assert(newFeed, 'Created feed must exist');

  // Enqueue for worker to fetch metadata and sync articles
  await enqueueFeedDetail(userId, feedId);
  await enqueueFeedSync(userId, feedId);

  // Track feed creation (server-side for reliability)
  trackEvent(userId, 'feeds:subscription_create', {
    feed_id: feedId,
    feed_url: data.url,
    source: 'manual',
  });

  return feedDbToApi(newFeed);
}

export async function updateFeed(id: string, data: UpdateFeed, userId: string): Promise<Feed> {
  const db = getDb();
  // Verify feed exists and belongs to user
  await getFeedById(id, userId);

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

  // Fetch and return the updated feed with consistent query structure
  return getFeedById(id, userId);
}

export async function deleteFeed(id: string, userId: string): Promise<void> {
  const db = getDb();
  const existingFeed = await db.query.feeds.findFirst({
    columns: { id: true },
    where: and(eq(feeds.id, id), eq(feeds.userId, userId)),
  });

  if (!existingFeed) {
    throw new NotFoundError();
  }

  await db.delete(feeds).where(and(eq(feeds.id, id), eq(feeds.userId, userId)));

  trackEvent(userId, 'feeds:subscription_delete', {
    feed_id: id,
  });
}

export async function discoverRssFeeds(url: string): Promise<DiscoveredFeed[]> {
  const [error, feeds] = await attemptAsync(discoverFeeds(url));
  if (error) {
    console.error('Discovery failed:', error);
    throw new BadRequestError(`Failed to discover feeds: ${String(error)}`);
  }
  return feeds;
}
