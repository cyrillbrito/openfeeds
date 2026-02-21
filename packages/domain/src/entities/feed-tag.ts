import { articles, articleTags, db, feedTags } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray } from 'drizzle-orm';
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

export async function createFeedTags(data: CreateFeedTag[], userId: string): Promise<FeedTag[]> {
  if (data.length === 0) return [];

  const newTags = data.map((item) => ({
    id: item.id ?? createId(),
    userId,
    feedId: item.feedId,
    tagId: item.tagId,
  }));

  const inserted = await db.insert(feedTags).values(newTags).onConflictDoNothing().returning();

  // Propagate: add these tags to all existing articles of the affected feeds
  if (inserted.length > 0) {
    await propagateTagsToArticles(inserted, userId);
  }

  return inserted;
}

export async function deleteFeedTags(ids: string[], userId: string): Promise<void> {
  if (ids.length === 0) return;

  // Look up which feed-tag pairs are being removed before deleting
  const toDelete = await db
    .select({ feedId: feedTags.feedId, tagId: feedTags.tagId })
    .from(feedTags)
    .where(and(inArray(feedTags.id, ids), eq(feedTags.userId, userId)));

  await db.delete(feedTags).where(and(inArray(feedTags.id, ids), eq(feedTags.userId, userId)));

  // Propagate: remove these tags from all articles of the affected feeds
  if (toDelete.length > 0) {
    await removeTagsFromFeedArticles(toDelete, userId);
  }
}

/**
 * Add tags to all existing articles of the given feeds.
 * Uses onConflictDoNothing so already-tagged articles are unaffected.
 */
async function propagateTagsToArticles(
  feedTagPairs: { feedId: string; tagId: string }[],
  userId: string,
): Promise<void> {
  // Get unique feed IDs
  const feedIds = [...new Set(feedTagPairs.map((ft) => ft.feedId))];

  // Get all articles for these feeds
  const feedArticles = await db
    .select({ id: articles.id, feedId: articles.feedId })
    .from(articles)
    .where(and(eq(articles.userId, userId), inArray(articles.feedId, feedIds)));

  if (feedArticles.length === 0) return;

  // Build article-tag pairs: for each article, add the tags that belong to its feed
  const tagsByFeed = new Map<string, string[]>();
  for (const ft of feedTagPairs) {
    const existing = tagsByFeed.get(ft.feedId) ?? [];
    existing.push(ft.tagId);
    tagsByFeed.set(ft.feedId, existing);
  }

  const articleTagValues = feedArticles.flatMap((article) => {
    const tagIds = tagsByFeed.get(article.feedId!) ?? [];
    return tagIds.map((tagId) => ({
      id: createId(),
      userId,
      articleId: article.id,
      tagId,
    }));
  });

  if (articleTagValues.length > 0) {
    await db.insert(articleTags).values(articleTagValues).onConflictDoNothing();
  }
}

/**
 * Remove tags from all articles that belong to the given feeds.
 */
async function removeTagsFromFeedArticles(
  feedTagPairs: { feedId: string; tagId: string }[],
  userId: string,
): Promise<void> {
  // Get unique feed IDs
  const feedIds = [...new Set(feedTagPairs.map((ft) => ft.feedId))];

  // Get all articles for these feeds
  const feedArticles = await db
    .select({ id: articles.id, feedId: articles.feedId })
    .from(articles)
    .where(and(eq(articles.userId, userId), inArray(articles.feedId, feedIds)));

  if (feedArticles.length === 0) return;

  // Build a map of feedId -> tagIds to remove
  const tagsByFeed = new Map<string, string[]>();
  for (const ft of feedTagPairs) {
    const existing = tagsByFeed.get(ft.feedId) ?? [];
    existing.push(ft.tagId);
    tagsByFeed.set(ft.feedId, existing);
  }

  // For each feed, delete article_tags where articleId belongs to that feed and tagId matches
  for (const [feedId, tagIds] of tagsByFeed) {
    const articleIds = feedArticles.filter((a) => a.feedId === feedId).map((a) => a.id);

    if (articleIds.length === 0) continue;

    await db
      .delete(articleTags)
      .where(
        and(
          eq(articleTags.userId, userId),
          inArray(articleTags.articleId, articleIds),
          inArray(articleTags.tagId, tagIds),
        ),
      );
  }
}
