import { feeds, feedTags, type DbInsertFeed, type UserDb } from '@repo/db';
import { discoverFeeds } from '@repo/discovery';
import {
  type CreateFeed,
  type DiscoveredFeed,
  type Feed,
  type UpdateFeed,
} from '@repo/shared/types';
import { attemptAsync, createId } from '@repo/shared/utils';
import { eq } from 'drizzle-orm';
import { feedDbToApi, type DbFeedWithTags } from './db-utils';
import { assert, BadRequestError, ConflictError, NotFoundError, UnexpectedError } from './errors';
import { fetchFeedMetadata } from './feed-details';
import { fetchRss, syncFeedArticles } from './rss-sync';

export async function getAllFeeds(db: UserDb): Promise<Feed[]> {
  const feedsWithTags = await db.query.feeds.findMany({
    with: {
      feedTags: {
        columns: { tagId: true },
      },
    },
  });

  return feedsWithTags.map(feedDbToApi);
}

/**
 * Get feed by ID with tags
 * Used for business logic that needs a single feed
 */
export async function getFeedById(id: string, db: UserDb): Promise<Feed> {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, id),
    with: {
      feedTags: {
        columns: { tagId: true },
      },
    },
  });

  if (!feed) {
    throw new NotFoundError();
  }

  return feedDbToApi(feed);
}

export async function createFeed(data: CreateFeed & { id?: string }, db: UserDb): Promise<Feed> {
  // Check if feed with this URL already exists
  const existingFeed = await db.query.feeds.findFirst({
    where: eq(feeds.feedUrl, data.url),
  });

  if (existingFeed) {
    throw new ConflictError('Feed with this URL already exists');
  }

  const feedResult = await fetchRss(data.url);

  const metadata = await fetchFeedMetadata(feedResult);
  const feed: DbInsertFeed = Object.assign(
    {
      id: data.id ?? createId(),
      title: 'Unknown',
      description: '',
      url: data.url,
      feedUrl: data.url,
      lastSyncAt: new Date(),
      createdAt: undefined,
    } satisfies DbInsertFeed,
    metadata,
  );

  const [err, dbResult] = await attemptAsync(db.insert(feeds).values(feed).returning());

  if (err) {
    // TODO Better drizzle error handling
    console.error('Database error creating feed:', err);
    throw new UnexpectedError();
  }

  const newFeed = dbResult[0];
  assert(newFeed, 'Created feed must exist');

  await syncFeedArticles(feedResult, newFeed.id, db);

  const dbFeedWithTags: DbFeedWithTags = {
    ...newFeed,
    feedTags: [],
  };

  return feedDbToApi(dbFeedWithTags);
}

export async function updateFeed(id: string, data: UpdateFeed, db: UserDb): Promise<Feed> {
  // Verify feed exists
  await getFeedById(id, db);

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
    await db.update(feeds).set(feedUpdateData).where(eq(feeds.id, id));
  }

  if (data.tags !== undefined) {
    await db.delete(feedTags).where(eq(feedTags.feedId, id));

    if (data.tags.length > 0) {
      const tagAssociations = data.tags.map((tagId: string) => ({
        id: createId(),
        feedId: id,
        tagId,
      }));
      await db.insert(feedTags).values(tagAssociations);
    }
  }

  // Fetch and return the updated feed with consistent query structure
  return getFeedById(id, db);
}

export async function deleteFeed(id: string, db: UserDb): Promise<void> {
  const existingFeed = await db.query.feeds.findFirst({
    columns: { id: true },
    where: eq(feeds.id, id),
  });

  if (!existingFeed) {
    throw new NotFoundError();
  }

  await db.delete(feeds).where(eq(feeds.id, id));
}

export async function syncFeed(id: string, db: UserDb): Promise<any> {
  const feed = await db.query.feeds.findFirst({
    where: eq(feeds.id, id),
  });

  if (!feed) {
    throw new NotFoundError();
  }

  const [fetchErr, feedResult] = await attemptAsync(fetchRss(feed.feedUrl));
  if (fetchErr) {
    throw new BadRequestError(`Failed to sync feed: ${String(fetchErr)}`);
  }

  const [syncErr, result] = await attemptAsync(syncFeedArticles(feedResult, feed.id, db));
  if (syncErr) {
    throw new BadRequestError(`Failed to sync feed articles: ${String(syncErr)}`);
  }

  const [updateErr] = await attemptAsync(
    db
      .update(feeds)
      .set({
        lastSyncAt: new Date(),
      })
      .where(eq(feeds.id, id)),
  );
  if (updateErr) {
    console.error('Database error updating feed sync time:', updateErr);
    throw new UnexpectedError();
  }

  return result;
}

export async function discoverRssFeeds(url: string): Promise<DiscoveredFeed[]> {
  const [error, feeds] = await attemptAsync(discoverFeeds(url));
  if (error) {
    console.error('Discovery failed:', error);
    throw new BadRequestError(`Failed to discover feeds: ${String(error)}`);
  }
  return feeds;
}
