import { db, feeds, type DbFeed, type DbInsertFeed } from '@repo/db';
import { discoverFeeds } from '@repo/discovery/server';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray } from 'drizzle-orm';
import { getDomain, trackEvent } from '../analytics';
import type { TransactionContext } from '../domain-context';
import { BadRequestError, LimitExceededError, NotFoundError } from '../errors';
import { countUserFeeds } from '../limits';
import { PLAN_LIMITS } from '../limits.schema';
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

export async function createFeeds(ctx: TransactionContext, data: CreateFeed[]): Promise<Feed[]> {
  if (data.length === 0) return [];

  // Check plan feed limit
  const limits = PLAN_LIMITS[ctx.plan];
  const currentCount = await countUserFeeds(ctx.userId, ctx.conn);
  if (currentCount + data.length > limits.feeds) {
    trackEvent(ctx.userId, 'limits:feeds_limit_hit', {
      source: 'create',
      current_usage: currentCount,
      limit: limits.feeds,
      plan: ctx.plan,
    });
    throw new LimitExceededError('feeds', limits.feeds);
  }

  const values: DbInsertFeed[] = data.map((item) => ({
    id: item.id ?? createId(),
    userId: ctx.userId,
    title: item.title ?? 'Unknown',
    description: item.description ?? '',
    url: item.url ?? item.feedUrl,
    feedUrl: item.feedUrl,
    icon: item.icon ?? null,
    lastSyncAt: null,
    createdAt: undefined,
  }));

  // NOTE: Duplicates are silently skipped via ON CONFLICT DO NOTHING.
  // The client already prevents following feeds the user already has, so conflicts
  // here are a race-condition safety net. We may want to revisit this and surface
  // skipped feeds to the caller if it causes confusion down the line.
  const inserted = await ctx.conn
    .insert(feeds)
    .values(values)
    .onConflictDoNothing({ target: [feeds.userId, feeds.feedUrl] })
    .returning();

  // Enqueue workers for all newly created feeds.
  // Deferred until after commit so workers don't query entities that don't exist yet.
  for (const feed of inserted) {
    ctx.afterCommit(() => enqueueFeedDetail(ctx.userId, feed.id));
    ctx.afterCommit(() => enqueueFeedSync(ctx.userId, feed.id));
  }

  // Track feed creations
  for (const feed of inserted) {
    trackEvent(ctx.userId, 'feeds:feed_create', {
      feed_url: feed.feedUrl,
      feed_domain: getDomain(feed.feedUrl),
    });
  }

  return inserted.map(toApiFeed);
}

export async function updateFeeds(ctx: TransactionContext, data: UpdateFeed[]): Promise<void> {
  if (data.length === 0) return;

  for (const { id, ...updates } of data) {
    const feedUpdateData: Record<string, unknown> = {};
    if (updates.title !== undefined) feedUpdateData.title = updates.title;
    if (updates.description !== undefined) feedUpdateData.description = updates.description;
    if (updates.url !== undefined) feedUpdateData.url = updates.url;
    if (updates.icon !== undefined) feedUpdateData.icon = updates.icon;

    if (Object.keys(feedUpdateData).length > 0) {
      await ctx.conn
        .update(feeds)
        .set(feedUpdateData)
        .where(and(eq(feeds.id, id), eq(feeds.userId, ctx.userId)));
    }
  }
}

export async function deleteFeeds(ctx: TransactionContext, ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  await ctx.conn.delete(feeds).where(and(inArray(feeds.id, ids), eq(feeds.userId, ctx.userId)));

  trackEvent(ctx.userId, 'feeds:feed_delete', { count: ids.length });
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
