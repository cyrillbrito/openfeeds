import { articleTags, getDb } from '@repo/db';
import { type ArticleTag } from '@repo/shared/types';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray } from 'drizzle-orm';

export async function getAllArticleTags(userId: string): Promise<ArticleTag[]> {
  const db = getDb();

  // article_tags has denormalized user_id for efficient filtering
  return db
    .select({
      id: articleTags.id,
      userId: articleTags.userId,
      articleId: articleTags.articleId,
      tagId: articleTags.tagId,
    })
    .from(articleTags)
    .where(eq(articleTags.userId, userId));
}

export interface CreateArticleTag {
  articleId: string;
  tagId: string;
}

export async function createArticleTags(
  data: CreateArticleTag[],
  userId: string,
): Promise<ArticleTag[]> {
  const db = getDb();

  if (data.length === 0) return [];

  const newTags = data.map((item) => ({
    id: createId(),
    userId,
    articleId: item.articleId,
    tagId: item.tagId,
  }));

  await db.insert(articleTags).values(newTags);

  return newTags;
}

export async function deleteArticleTags(ids: string[], userId: string): Promise<void> {
  const db = getDb();

  if (ids.length === 0) return;

  await db
    .delete(articleTags)
    .where(and(inArray(articleTags.id, ids), eq(articleTags.userId, userId)));
}
