import { articles, articleTags, feedTags, type UserDb } from '@repo/db';
import {
  type Article,
  type ArticleQuery,
  type MarkManyReadRequest,
  type MarkManyReadResponse,
  type PaginatedResponse,
  type UpdateArticle,
} from '@repo/shared/types';
import { and, count, desc, eq, inArray, isNull, like, lt, or, sql } from 'drizzle-orm';
import { articleDbToApi } from './db-utils';
import { BadRequestError, NotFoundError } from './errors';

export async function getArticles(
  filters: ArticleQuery,
  db: UserDb,
): Promise<PaginatedResponse<Article>> {
  const { cursor, limit, feedId, tagId, isRead, isArchived, type, search, seed } = filters;

  const queryLimit = limit ? limit + 1 : undefined;

  // Build base filters (excluding cursor and pagination)
  const whereConditions = [];

  // Feed filter
  if (feedId) {
    whereConditions.push(eq(articles.feedId, feedId));
  }

  // Tag filter - filter by articles that have this tag
  if (tagId) {
    const articlesWithTag = await db
      .selectDistinct({ articleId: articleTags.articleId })
      .from(articleTags)
      .where(eq(articleTags.tagId, tagId));
    const articleIds = articlesWithTag.map((at) => at.articleId);

    if (articleIds.length === 0) {
      // No articles with this tag, return empty result
      whereConditions.push(sql`1 = 0`);
    } else {
      whereConditions.push(inArray(articles.id, articleIds));
    }
  }

  // Read status filter - only apply if explicitly passed
  if (isRead !== undefined) {
    whereConditions.push(eq(articles.isRead, isRead));
  }

  // Archive status filter - only apply if explicitly passed
  if (isArchived !== undefined) {
    whereConditions.push(eq(articles.isArchived, isArchived));
  }

  // Type filter
  if (type === 'shorts') {
    whereConditions.push(like(articles.url, '%youtube.com/shorts%'));
  }

  // Search filter (TODO: implement full-text search when needed)
  if (search) {
    // TODO: Implement full-text search when needed
    // For now, we could add basic title search
    // whereConditions.push(like(articles.title, `%${search}%`));
  }

  const baseWhereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  // Get total count (same filters, no cursor)
  const totalResult = await db.select({ count: count() }).from(articles).where(baseWhereClause);

  const totalCount = totalResult[0]?.count || 0;

  // Query articles based on mode
  let results;
  let nextCursor: string | null = null;

  if (seed) {
    // SHUFFLE MODE: Deterministic random ordering

    // Add cursor pagination for shuffle mode
    if (cursor) {
      const cursorValue = +cursor;
      const cursorCondition = sql`(${articles.id} * ${seed}) % 2147483647 > ${cursorValue}`;
      whereConditions.push(cursorCondition);
    }

    // Execute shuffle query using Drizzle with article tags
    results = await db.query.articles.findMany({
      where: whereConditions.length ? and(...whereConditions) : undefined,
      orderBy: sql`(${articles.id} * ${seed}) % 2147483647`,
      limit: queryLimit || 10000,
      with: {
        articleTags: {
          columns: {
            tagId: true,
          },
        },
      },
    });

    // Handle shuffle pagination
    if (limit && results.length > limit) {
      results.pop();
      nextCursor = ((results.at(-1)!.id * seed) % 2147483647).toString();
    }
  } else {
    // NORMAL MODE: Publication date ordering

    // Add cursor pagination for normal mode
    if (cursor) {
      const cursorCondition = lt(articles.pubDate, new Date(cursor));
      whereConditions.push(cursorCondition);
    }

    // Execute normal query using Drizzle with article tags
    results = await db.query.articles.findMany({
      where: whereConditions.length ? and(...whereConditions) : undefined,
      orderBy: desc(articles.pubDate),
      limit: queryLimit || 10000,
      with: {
        articleTags: {
          columns: {
            tagId: true,
          },
        },
      },
    });

    // Handle normal pagination
    if (limit && results.length > limit) {
      results.pop();
      nextCursor = results.at(-1)?.pubDate?.toISOString() || null;
    }
  }

  const apiArticles = results.map(articleDbToApi);

  return {
    data: apiArticles,
    nextCursor,
    total: totalCount,
  };
}

/**
 * Get article by ID with just the base data (no cleanContent)
 * Used for business logic that needs a single article (e.g., after updates)
 */
export async function getArticleById(id: number, db: UserDb): Promise<Article> {
  const article = await db.query.articles.findFirst({
    where: eq(articles.id, id),
    with: {
      articleTags: {
        columns: {
          tagId: true,
        },
      },
    },
  });

  if (!article) {
    throw new NotFoundError();
  }

  return articleDbToApi(article);
}

/**
 * Get article by ID with full content (including cleanContent)
 * Used for the reader view where we need the processed article content
 */
export async function getArticleWithContent(
  id: number,
  db: UserDb,
): Promise<Article & { cleanContent: string | null }> {
  const article = await db.query.articles.findFirst({
    where: eq(articles.id, id),
    with: {
      articleTags: {
        columns: {
          tagId: true,
        },
      },
    },
  });

  if (!article) {
    throw new NotFoundError();
  }

  const apiArticle = articleDbToApi(article);

  return {
    ...apiArticle,
    cleanContent: article.cleanContent ?? null,
  };
}

export async function updateArticle(id: number, data: UpdateArticle, db: UserDb): Promise<Article> {
  // Update article fields (excluding tags)
  const { tags, ...articleData } = data;

  if (Object.keys(articleData).length > 0) {
    const [updatedArticle] = await db
      .update(articles)
      .set(articleData)
      .where(eq(articles.id, id))
      .returning();

    if (!updatedArticle) {
      throw new NotFoundError();
    }
  }

  // Update tags if provided
  if (tags !== undefined) {
    // Delete existing article tags
    await db.delete(articleTags).where(eq(articleTags.articleId, id));

    // Insert new article tags
    if (tags.length > 0) {
      await db.insert(articleTags).values(
        tags.map((tagId) => ({
          articleId: id,
          tagId,
        })),
      );
    }
  }

  // Fetch and return the updated article with consistent query structure
  return getArticleById(id, db);
}

export async function markManyArticlesRead(
  request: MarkManyReadRequest,
  db: UserDb,
): Promise<MarkManyReadResponse> {
  const { context, feedId, tagId } = request;

  // Validate context-specific parameters
  if (context === 'feed' && !feedId) {
    throw new BadRequestError();
  }
  if (context === 'tag' && !tagId) {
    throw new BadRequestError();
  }

  let whereClause;

  switch (context) {
    case 'all':
      whereClause = or(eq(articles.isRead, false), isNull(articles.isRead));
      break;

    case 'feed':
      whereClause = and(
        eq(articles.feedId, feedId!),
        or(eq(articles.isRead, false), isNull(articles.isRead)),
      );
      break;

    case 'tag':
      // Get all feeds that have this tag
      const feedsWithTag = await db.query.feedTags.findMany({
        where: eq(feedTags.tagId, tagId!),
      });

      if (feedsWithTag.length === 0) {
        return { success: true, markedCount: 0 };
      }

      const feedIds = feedsWithTag.map((ft) => ft.feedId);
      whereClause = and(
        inArray(articles.feedId, feedIds),
        or(eq(articles.isRead, false), isNull(articles.isRead)),
      );
      break;

    default:
      throw new BadRequestError();
  }

  // Update all matching articles to read
  const result = await db
    .update(articles)
    .set({ isRead: true })
    .where(whereClause)
    .returning({ id: articles.id });

  return { success: true, markedCount: result.length };
}
