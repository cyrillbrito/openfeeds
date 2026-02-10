import { feedTags, getDb } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray } from 'drizzle-orm';
import type { CreateFeedTag, FeedTag } from './feed-tag.schema';

// Re-export schemas and types from schema file
export * from './feed-tag.schema';

export async function getAllFeedTags(userId: string): Promise<FeedTag[]> {
  const db = getDb();

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

export async function createFeedTags(data: CreateFeedTag[], userId: string): Promise<FeedTag[]> {
  const db = getDb();

  if (data.length === 0) return [];

  const newTags = data.map((item) => ({
    id: createId(),
    userId,
    feedId: item.feedId,
    tagId: item.tagId,
  }));

  await db.insert(feedTags).values(newTags);

  return newTags;
}

export async function deleteFeedTags(ids: string[], userId: string): Promise<void> {
  const db = getDb();

  if (ids.length === 0) return;

  await db.delete(feedTags).where(and(inArray(feedTags.id, ids), eq(feedTags.userId, userId)));
}
