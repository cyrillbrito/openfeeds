import { db, feedTags, type Db, type Transaction } from '@repo/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { CreateFeedTag, FeedTag } from './feed-tag.schema';

// Re-export schemas and types from schema file
export * from './feed-tag.schema';

export async function getAllFeedTags(userId: string): Promise<FeedTag[]> {
  // feed_tags has denormalized user_id for efficient filtering
  return db
    .select({
      id: feedTags.id,
      userId: feedTags.userId,
      feedId: feedTags.feedId,
      tagId: feedTags.tagId,
    })
    .from(feedTags)
    .where(eq(feedTags.userId, userId));
}

export async function createFeedTags(
  data: CreateFeedTag[],
  userId: string,
  conn: Db | Transaction,
): Promise<FeedTag[]> {
  if (data.length === 0) return [];

  const newTags = data.map((item) => ({
    id: item.id,
    userId,
    feedId: item.feedId,
    tagId: item.tagId,
  }));

  return conn.transaction(async (tx) => {
    const inserted = await tx.insert(feedTags).values(newTags).onConflictDoNothing().returning();

    // Propagate: add these tags to all existing articles of the affected feeds
    if (inserted.length > 0) {
      await propagateTagsToArticles(tx, inserted, userId);
    }

    return inserted;
  });
}

export async function deleteFeedTags(
  ids: string[],
  userId: string,
  conn: Db | Transaction,
): Promise<void> {
  if (ids.length === 0) return;

  await conn.transaction(async (tx) => {
    // Single DELETE ... RETURNING to get the pairs and remove in one query
    const deleted = await tx
      .delete(feedTags)
      .where(and(inArray(feedTags.id, ids), eq(feedTags.userId, userId)))
      .returning({ feedId: feedTags.feedId, tagId: feedTags.tagId });

    // Propagate: remove these tags from all articles of the affected feeds
    if (deleted.length > 0) {
      await removeTagsFromFeedArticles(tx, deleted, userId);
    }
  });
}

/**
 * Add tags to all existing articles of the given feeds.
 * Single INSERT ... SELECT — IDs are generated server-side via uuidv7() default.
 * ON CONFLICT DO NOTHING so already-tagged articles are unaffected.
 */
async function propagateTagsToArticles(
  tx: Transaction,
  feedTagPairs: { feedId: string; tagId: string }[],
  userId: string,
): Promise<void> {
  // Build a VALUES list of (feed_id, tag_id) pairs for the join
  const pairsSql = feedTagPairs
    .map((ft) => sql`(${ft.feedId}::uuid, ${ft.tagId}::uuid)`)
    .reduce((acc, val) => sql`${acc}, ${val}`);

  await tx.execute(sql`
    INSERT INTO article_tags (user_id, article_id, tag_id)
    SELECT ${userId}, a.id, ft.tag_id
    FROM articles a
    JOIN (VALUES ${pairsSql}) AS ft(feed_id, tag_id)
      ON a.feed_id = ft.feed_id
    WHERE a.user_id = ${userId}
    ON CONFLICT DO NOTHING
  `);
}

/**
 * Remove tags from all articles that belong to the given feeds.
 * Single DELETE ... USING to avoid N+1 queries.
 */
async function removeTagsFromFeedArticles(
  tx: Transaction,
  feedTagPairs: { feedId: string; tagId: string }[],
  userId: string,
): Promise<void> {
  const pairsSql = feedTagPairs
    .map((ft) => sql`(${ft.feedId}::uuid, ${ft.tagId}::uuid)`)
    .reduce((acc, val) => sql`${acc}, ${val}`);

  await tx.execute(sql`
    DELETE FROM article_tags
    USING articles a, (VALUES ${pairsSql}) AS ft(feed_id, tag_id)
    WHERE article_tags.article_id = a.id
      AND a.feed_id = ft.feed_id
      AND article_tags.tag_id = ft.tag_id
      AND article_tags.user_id = ${userId}
  `);
}
