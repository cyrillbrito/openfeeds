import { articleTags, db, type Db, type Transaction } from '@repo/db';
import { createId } from '@repo/shared/utils';
import { and, eq, inArray } from 'drizzle-orm';
import type { ArticleTag, CreateArticleTag } from './article-tag.schema';

// Re-export schemas and types from schema file
export * from './article-tag.schema';

export async function getAllArticleTags(userId: string): Promise<ArticleTag[]> {
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

export async function createArticleTags(
  data: CreateArticleTag[],
  userId: string,
  conn: Db | Transaction,
): Promise<ArticleTag[]> {
  if (data.length === 0) return [];

  const newTags = data.map((item) => ({
    id: item.id ?? createId(),
    userId,
    articleId: item.articleId,
    tagId: item.tagId,
  }));

  return conn.insert(articleTags).values(newTags).onConflictDoNothing().returning();
}

export async function deleteArticleTags(
  ids: string[],
  userId: string,
  conn: Db | Transaction,
): Promise<void> {
  if (ids.length === 0) return;

  await conn
    .delete(articleTags)
    .where(and(inArray(articleTags.id, ids), eq(articleTags.userId, userId)));
}
