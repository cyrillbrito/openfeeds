import { articles, articleTags, getDb } from '@repo/db';
import { type ArticleTag } from '@repo/shared/types';
import { eq } from 'drizzle-orm';

export async function getAllArticleTags(userId: string): Promise<ArticleTag[]> {
  const db = getDb();

  // Join articleTags with articles to filter by userId in a single query
  return db
    .select({
      id: articleTags.id,
      articleId: articleTags.articleId,
      tagId: articleTags.tagId,
    })
    .from(articleTags)
    .innerJoin(articles, eq(articleTags.articleId, articles.id))
    .where(eq(articles.userId, userId));
}
