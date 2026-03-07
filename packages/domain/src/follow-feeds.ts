import type { TransactionContext } from './domain-context';
import { createFeeds } from './entities/feed';
import { createFeedTags } from './entities/feed-tag';
import { createTags } from './entities/tag';
import type { FollowFeedsWithTags } from './follow-feeds.schema';

// Re-export schema for barrel
export * from './follow-feeds.schema';

// ---------------------------------------------------------------------------
// Domain function
// ---------------------------------------------------------------------------

/**
 * Follow feeds with tag assignments.
 *
 * Orchestrates entity-level functions in the correct order so FK constraints
 * are always satisfied: feeds first, then tags, then feed-tag associations.
 *
 * Each entity function handles its own concerns (limits, conflict skipping,
 * analytics, job enqueuing). This function only coordinates the order and
 * filters feed-tags to only reference actually-inserted feeds.
 *
 * Must be called with a `TransactionContext`. Job enqueues inside `createFeeds`
 * are deferred via `ctx.afterCommit()` until after the transaction commits,
 * preventing workers from querying entities that don't exist yet.
 */
export async function followFeedsWithTags(
  ctx: TransactionContext,
  data: FollowFeedsWithTags,
): Promise<void> {
  if (data.feeds.length === 0) return;

  // 1. Create feeds (handles limits, skips duplicates, enqueues jobs, tracks analytics)
  const insertedFeeds = await createFeeds(
    ctx,
    data.feeds.map((f) => ({
      id: f.id,
      url: f.url,
      feedUrl: f.feedUrl,
      title: f.title,
      description: f.description,
      icon: f.icon,
    })),
  );

  if (data.newTags.length > 0) {
    await createTags(
      ctx,
      data.newTags.map((t) => ({ id: t.id, name: t.name })),
    );
  }

  if (data.feedTags.length > 0) {
    const insertedFeedIds = new Set(insertedFeeds.map((f) => f.id));
    const validFeedTags = data.feedTags.filter((ft) => insertedFeedIds.has(ft.feedId));

    if (validFeedTags.length > 0) {
      await createFeedTags(ctx, validFeedTags);
    }
  }
}
