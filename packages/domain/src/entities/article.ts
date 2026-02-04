import { articles, articleTags, feedTags, getDb } from '@repo/db';
import { fetchArticleContent } from '@repo/readability/server';
import { createId } from '@repo/shared/utils';
import { and, count, desc, eq, inArray, isNull, like, lt, or, sql } from 'drizzle-orm';
import { articleDbToApi } from '../db-utils';
import { BadRequestError, NotFoundError } from '../errors';
import type {
  Article,
  ArticleQuery,
  CreateArticleFromUrl,
  MarkManyArchivedRequest,
  MarkManyArchivedResponse,
  UpdateArticle,
} from './article.schema';
import type { PaginatedResponse } from './common.schema';

// Re-export schemas and types from schema file
export * from './article.schema';

export async function getArticles(
  filters: ArticleQuery,
  userId: string,
): Promise<PaginatedResponse<Article>> {
  const db = getDb();
  const { cursor, limit, feedId, tagId, isRead, isArchived, type, search, ids, urlLike } = filters;

  const queryLimit = limit ? limit + 1 : undefined;

  const whereConditions = [];

  whereConditions.push(eq(articles.userId, userId));

  if (feedId) {
    whereConditions.push(eq(articles.feedId, feedId));
  }

  if (tagId) {
    const articlesWithTag = await db
      .selectDistinct({ articleId: articleTags.articleId })
      .from(articleTags)
      .where(eq(articleTags.tagId, tagId));
    const articleIds = articlesWithTag.map((at) => at.articleId);

    if (articleIds.length === 0) {
      whereConditions.push(sql`1 = 0`);
    } else {
      whereConditions.push(inArray(articles.id, articleIds));
    }
  }

  if (ids && ids.length > 0) {
    whereConditions.push(inArray(articles.id, ids));
  }

  if (isRead !== undefined) {
    whereConditions.push(eq(articles.isRead, isRead));
  }

  if (isArchived !== undefined) {
    whereConditions.push(eq(articles.isArchived, isArchived));
  }

  if (type === 'shorts') {
    whereConditions.push(like(articles.url, '%youtube.com/shorts%'));
  }

  if (urlLike) {
    whereConditions.push(like(articles.url, urlLike));
  }

  if (search) {
    // TODO: Implement full-text search when needed
  }

  const baseWhereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const totalResult = await db.select({ count: count() }).from(articles).where(baseWhereClause);
  const totalCount = totalResult[0]?.count || 0;

  if (cursor) {
    const cursorCondition = lt(articles.pubDate, new Date(cursor));
    whereConditions.push(cursorCondition);
  }

  const results = await db.query.articles.findMany({
    where: whereConditions.length ? and(...whereConditions) : undefined,
    orderBy: desc(articles.pubDate),
    limit: queryLimit || 10000,
  });

  let nextCursor: string | null = null;
  if (limit && results.length > limit) {
    results.pop();
    nextCursor = results.at(-1)?.pubDate?.toISOString() || null;
  }

  const apiArticles = results.map(articleDbToApi);

  return {
    data: apiArticles,
    nextCursor,
    total: totalCount,
  };
}

export async function getArticleById(id: string, userId: string): Promise<Article> {
  const db = getDb();
  const article = await db.query.articles.findFirst({
    where: and(eq(articles.id, id), eq(articles.userId, userId)),
  });

  if (!article) {
    throw new NotFoundError();
  }

  return articleDbToApi(article);
}

function isYouTubeUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

export async function getArticleWithContent(
  id: string,
  userId: string,
): Promise<Article & { cleanContent: string | null }> {
  const db = getDb();
  const article = await db.query.articles.findFirst({
    where: and(eq(articles.id, id), eq(articles.userId, userId)),
  });

  if (!article) {
    throw new NotFoundError();
  }

  let cleanContent = article.cleanContent ?? null;
  let description = article.description;

  if (!article.contentExtractedAt && article.url && !isYouTubeUrl(article.url)) {
    try {
      const extracted = await fetchArticleContent(article.url);
      cleanContent = extracted.content ?? null;

      const updateData: {
        cleanContent: string | null;
        contentExtractedAt: Date;
        description?: string;
      } = {
        cleanContent,
        contentExtractedAt: new Date(),
      };

      if (!description && extracted.excerpt) {
        description = extracted.excerpt;
        updateData.description = extracted.excerpt;
      }

      await db.update(articles).set(updateData).where(eq(articles.id, id));
    } catch (error) {
      console.error(`Failed to extract content for article ${id}:`, error);
    }
  }

  const apiArticle = articleDbToApi(article);

  return {
    ...apiArticle,
    cleanContent,
  };
}

export async function updateArticle(
  id: string,
  data: UpdateArticle,
  userId: string,
): Promise<Article> {
  const db = getDb();

  if (Object.keys(data).length > 0) {
    const [updatedArticle] = await db
      .update(articles)
      .set(data)
      .where(and(eq(articles.id, id), eq(articles.userId, userId)))
      .returning();

    if (!updatedArticle) {
      throw new NotFoundError();
    }
  }

  return getArticleById(id, userId);
}

export async function markManyArticlesArchived(
  request: MarkManyArchivedRequest,
  userId: string,
): Promise<MarkManyArchivedResponse> {
  const db = getDb();
  const { context, feedId, tagId } = request;

  if (context === 'feed' && !feedId) {
    throw new BadRequestError();
  }
  if (context === 'tag' && !tagId) {
    throw new BadRequestError();
  }

  const userCondition = eq(articles.userId, userId);
  const notArchivedCondition = or(eq(articles.isArchived, false), isNull(articles.isArchived));

  let whereClause;

  switch (context) {
    case 'all':
      whereClause = and(userCondition, notArchivedCondition);
      break;

    case 'feed':
      whereClause = and(userCondition, eq(articles.feedId, feedId!), notArchivedCondition);
      break;

    case 'tag':
      const feedsWithTag = await db.query.feedTags.findMany({
        where: eq(feedTags.tagId, tagId!),
      });

      if (feedsWithTag.length === 0) {
        return { success: true, markedCount: 0 };
      }

      const feedIds = feedsWithTag.map((ft) => ft.feedId);
      whereClause = and(userCondition, inArray(articles.feedId, feedIds), notArchivedCondition);
      break;

    default:
      throw new BadRequestError();
  }

  const result = await db
    .update(articles)
    .set({ isArchived: true })
    .where(whereClause)
    .returning({ id: articles.id });

  return { success: true, markedCount: result.length };
}

export async function createArticle(data: CreateArticleFromUrl, userId: string): Promise<Article> {
  const db = getDb();
  const articleId = data.id ?? createId();
  const now = new Date();

  const {
    title: extractedTitle,
    excerpt,
    content: cleanContent,
  } = await fetchArticleContent(data.url);

  await db.insert(articles).values({
    id: articleId,
    userId,
    feedId: null,
    title: extractedTitle || data.url,
    description: excerpt,
    url: data.url,
    pubDate: now,
    createdAt: now,
    isRead: false,
    isArchived: false,
    cleanContent,
  });

  return getArticleById(articleId, userId);
}
