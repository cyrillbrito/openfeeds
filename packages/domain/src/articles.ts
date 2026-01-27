import { articles, articleTags, feedTags, type UserDb } from '@repo/db';
import { fetchArticleContent } from '@repo/readability/server';
import {
  type Article,
  type ArticleQuery,
  type CreateArticleFromUrl,
  type MarkManyArchivedRequest,
  type MarkManyArchivedResponse,
  type PaginatedResponse,
  type UpdateArticle,
} from '@repo/shared/types';
import { createId } from '@repo/shared/utils';
import { and, count, desc, eq, inArray, isNull, like, lt, or, sql } from 'drizzle-orm';
import { articleDbToApi } from './db-utils';
import { BadRequestError, NotFoundError } from './errors';

export async function getArticles(
  filters: ArticleQuery,
  db: UserDb,
): Promise<PaginatedResponse<Article>> {
  const { cursor, limit, feedId, tagId, isRead, isArchived, type, search, ids, urlLike } = filters;

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

  // IDs filter - load specific articles by ID (used by local joins)
  if (ids && ids.length > 0) {
    whereConditions.push(inArray(articles.id, ids));
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

  // URL like filter (for ilike queries from client)
  if (urlLike) {
    whereConditions.push(like(articles.url, urlLike));
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

  // Add cursor pagination
  if (cursor) {
    const cursorCondition = lt(articles.pubDate, new Date(cursor));
    whereConditions.push(cursorCondition);
  }

  // Execute query using Drizzle with article tags
  const results = await db.query.articles.findMany({
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

  // Handle pagination
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

/**
 * Get article by ID with just the base data (no cleanContent)
 * Used for business logic that needs a single article (e.g., after updates)
 */
export async function getArticleById(id: string, db: UserDb): Promise<Article> {
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
 * Check if URL is a YouTube video (which doesn't need content extraction)
 */
function isYouTubeUrl(url: string | null): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

/**
 * Get article by ID with full content (including cleanContent)
 * Used for the reader view where we need the processed article content
 *
 * Content extraction is done on-demand: if the article doesn't have cleanContent
 * yet and has a valid URL (non-YouTube), it will be extracted and saved.
 */
export async function getArticleWithContent(
  id: string,
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

  let cleanContent = article.cleanContent ?? null;
  let description = article.description;

  // On-demand content extraction: if not yet extracted and has a valid URL
  if (!article.contentExtractedAt && article.url && !isYouTubeUrl(article.url)) {
    try {
      const extracted = await fetchArticleContent(article.url);
      cleanContent = extracted.content ?? null;

      // Build update object
      const updateData: {
        cleanContent: string | null;
        contentExtractedAt: Date;
        description?: string;
      } = {
        cleanContent,
        contentExtractedAt: new Date(),
      };

      // Use extracted excerpt as description if article doesn't have one
      if (!description && extracted.excerpt) {
        description = extracted.excerpt;
        updateData.description = extracted.excerpt;
      }

      // Persist the extracted content so we don't need to fetch again
      await db.update(articles).set(updateData).where(eq(articles.id, id));
    } catch (error) {
      // Log but don't fail the request - user can still see RSS content
      console.error(`Failed to extract content for article ${id}:`, error);
    }
  }

  const apiArticle = articleDbToApi(article);

  return {
    ...apiArticle,
    cleanContent,
  };
}

export async function updateArticle(id: string, data: UpdateArticle, db: UserDb): Promise<Article> {
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
          id: createId(),
          articleId: id,
          tagId,
        })),
      );
    }
  }

  // Fetch and return the updated article with consistent query structure
  return getArticleById(id, db);
}

export async function markManyArticlesArchived(
  request: MarkManyArchivedRequest,
  db: UserDb,
): Promise<MarkManyArchivedResponse> {
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
      whereClause = or(eq(articles.isArchived, false), isNull(articles.isArchived));
      break;

    case 'feed':
      whereClause = and(
        eq(articles.feedId, feedId!),
        or(eq(articles.isArchived, false), isNull(articles.isArchived)),
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
        or(eq(articles.isArchived, false), isNull(articles.isArchived)),
      );
      break;

    default:
      throw new BadRequestError();
  }

  // Update all matching articles to archived
  const result = await db
    .update(articles)
    .set({ isArchived: true })
    .where(whereClause)
    .returning({ id: articles.id });

  return { success: true, markedCount: result.length };
}

/**
 * Create an article from a URL (not tied to any feed)
 * Used for "save for later" functionality like Pocket
 * Fetches and extracts clean content using Readability
 */
export async function createArticle(data: CreateArticleFromUrl, db: UserDb): Promise<Article> {
  const articleId = data.id ?? createId();
  const now = new Date();

  // Fetch and extract article content
  const {
    title: extractedTitle,
    excerpt,
    content: cleanContent,
  } = await fetchArticleContent(data.url);

  // Insert the article with null feedId
  await db.insert(articles).values({
    id: articleId,
    feedId: null,
    title: extractedTitle || data.url, // Use extracted title, fallback to URL
    description: excerpt,
    url: data.url,
    pubDate: now,
    createdAt: now,
    isRead: false,
    isArchived: false,
    cleanContent,
  });

  // Add tags if provided
  if (data.tags && data.tags.length > 0) {
    await db.insert(articleTags).values(
      data.tags.map((tagId) => ({
        id: createId(),
        articleId,
        tagId,
      })),
    );
  }

  return getArticleById(articleId, db);
}
