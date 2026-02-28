import type { Db, Transaction } from '@repo/db';
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
 * Wraps all operations in a single transaction for atomicity. When called
 * with `conn = tx` (already inside a transaction), creates a savepoint.
 */
export async function followFeedsWithTags(
  data: FollowFeedsWithTags,
  userId: string,
  conn: Db | Transaction,
): Promise<void> {
  if (data.feeds.length === 0) return;

  await conn.transaction(async (tx) => {
    // 1. Create feeds (handles limits, skips duplicates, enqueues jobs, tracks analytics)
    const insertedFeeds = await createFeeds(
      data.feeds.map((f) => ({ id: f.id, url: f.url })),
      userId,
      tx,
    );

    if (data.newTags.length > 0) {
      await createTags(
        data.newTags.map((t) => ({ id: t.id, name: t.name })),
        userId,
        tx,
      );
    }

    if (data.feedTags.length > 0) {
      const insertedFeedIds = new Set(insertedFeeds.map((f) => f.id));
      const validFeedTags = data.feedTags.filter((ft) => insertedFeedIds.has(ft.feedId));

      if (validFeedTags.length > 0) {
        await createFeedTags(validFeedTags, userId, tx);
      }
    }
  });
}
