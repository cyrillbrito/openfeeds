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
 * NOTE: This does not run inside a single transaction — each entity function
 * uses its own DB connection. The upcoming txid refactor will add a shared
 * `conn` parameter to all domain functions, at which point this orchestrator
 * can wrap everything in a single transaction.
 */
export async function followFeedsWithTags(
  data: FollowFeedsWithTags,
  userId: string,
): Promise<void> {
  if (data.feeds.length === 0) return;

  // 1. Create feeds (handles limits, skips duplicates, enqueues jobs, tracks analytics)
  const insertedFeeds = await createFeeds(
    data.feeds.map((f) => ({ id: f.id, url: f.url })),
    userId,
  );

  if (data.newTags.length > 0) {
    await createTags(
      data.newTags.map((t) => ({ id: t.id, name: t.name })),
      userId,
    );
  }

  if (data.feedTags.length > 0) {
    const insertedFeedIds = new Set(insertedFeeds.map((f) => f.id));
    const validFeedTags = data.feedTags.filter((ft) => insertedFeedIds.has(ft.feedId));

    if (validFeedTags.length > 0) {
      await createFeedTags(validFeedTags, userId);
    }
  }
}
