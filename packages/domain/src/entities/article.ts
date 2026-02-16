import { articles, db } from '@repo/db';
import { fetchArticleContent } from '@repo/readability/server';
import { createId } from '@repo/shared/utils';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { assert, LimitExceededError, NotFoundError } from '../errors';
import { FREE_TIER_LIMITS } from '../limits';
import type { Article, CreateArticleFromUrl, UpdateArticle } from './article.schema';

// Re-export schemas and types from schema file
export * from './article.schema';

export async function getArticleById(id: string, userId: string): Promise<Article> {
  const article = await db.query.articles.findFirst({
    where: and(eq(articles.id, id), eq(articles.userId, userId)),
  });

  if (!article) {
    throw new NotFoundError();
  }

  return {
    id: article.id,
    userId: article.userId,
    feedId: article.feedId,
    title: article.title,
    url: article.url,
    description: article.description,
    content: article.content,
    author: article.author,
    pubDate: article.pubDate?.toISOString() ?? null,
    isRead: article.isRead,
    isArchived: article.isArchived,
    cleanContent: article.cleanContent ?? null,
    contentExtractedAt: article.contentExtractedAt?.toISOString() ?? null,
    createdAt: article.createdAt.toISOString(),
  };
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

/**
 * Check whether a user has exceeded their content extraction rate limits.
 * Uses the `contentExtractedAt` column as a natural extraction timestamp.
 * Returns the window that was hit ('daily' | 'monthly') or null if within limits.
 */
async function getExtractionLimitWindow(
  userId: string,
): Promise<{ window: 'daily' | 'monthly'; current_usage: number; limit: number } | null> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [daily, monthly] = await Promise.all([
    db
      .select({ count: count() })
      .from(articles)
      .where(and(eq(articles.userId, userId), sql`${articles.contentExtractedAt} >= ${oneDayAgo}`))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(articles)
      .where(
        and(eq(articles.userId, userId), sql`${articles.contentExtractedAt} >= ${thirtyDaysAgo}`),
      )
      .then((r) => r[0]?.count ?? 0),
  ]);

  // Check daily first (more likely to be hit in normal use)
  if (daily >= FREE_TIER_LIMITS.extractionsPerDay) {
    return { window: 'daily', current_usage: daily, limit: FREE_TIER_LIMITS.extractionsPerDay };
  }
  if (monthly >= FREE_TIER_LIMITS.extractionsPerMonth) {
    return {
      window: 'monthly',
      current_usage: monthly,
      limit: FREE_TIER_LIMITS.extractionsPerMonth,
    };
  }
  return null;
}

/**
 * Extract readable content for an article on-demand.
 * Fetches the article URL, runs Readability, and stores the result.
 * Skips if content was already extracted (contentExtractedAt is set).
 * Returns the clean content (or null if extraction failed/not possible).
 */
export async function extractArticleContent(id: string, userId: string): Promise<string | null> {
  const article = await db.query.articles.findFirst({
    where: and(eq(articles.id, id), eq(articles.userId, userId)),
  });

  if (!article) {
    throw new NotFoundError();
  }

  // Already extracted (even if cleanContent is null - means extraction was attempted)
  if (article.contentExtractedAt) {
    return article.cleanContent ?? null;
  }

  // Nothing to extract from
  if (!article.url || isYouTubeUrl(article.url)) {
    return null;
  }

  // Check extraction rate limit (daily + monthly)
  const extractionLimit = await getExtractionLimitWindow(userId);
  if (extractionLimit) {
    trackEvent(userId, 'limits:extractions_limit_hit', extractionLimit);
    const windowLabel = extractionLimit.window === 'daily' ? 'daily' : 'monthly';
    throw new LimitExceededError(`${windowLabel} content extractions`, extractionLimit.limit);
  }

  try {
    const extracted = await fetchArticleContent(article.url);
    const cleanContent = extracted.content ?? null;

    const updateData: {
      cleanContent: string | null;
      contentExtractedAt: Date;
      description?: string;
    } = {
      cleanContent,
      contentExtractedAt: new Date(),
    };

    if (!article.description && extracted.excerpt) {
      updateData.description = extracted.excerpt;
    }

    await db.update(articles).set(updateData).where(eq(articles.id, id));

    return cleanContent;
  } catch (error) {
    // Mark as extracted even on failure to avoid retrying indefinitely
    await db.update(articles).set({ contentExtractedAt: new Date() }).where(eq(articles.id, id));
    console.error(`Failed to extract content for article ${id}:`, error);
    return null;
  }
}

export async function updateArticles(data: UpdateArticle[], userId: string): Promise<void> {
  if (data.length === 0) return;

  await db.transaction(async (tx) => {
    for (const { id, ...updates } of data) {
      if (Object.keys(updates).length === 0) continue;

      await tx
        .update(articles)
        .set(updates)
        .where(and(eq(articles.id, id), eq(articles.userId, userId)));
    }
  });
}

export async function createArticle(data: CreateArticleFromUrl, userId: string): Promise<Article> {
  // Check free-tier saved article limit (only user-created articles, not feed-synced)
  const [savedCount] = await db
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), isNull(articles.feedId)));
  if (savedCount && savedCount.count >= FREE_TIER_LIMITS.savedArticles) {
    trackEvent(userId, 'limits:saved_articles_limit_hit', {
      current_usage: savedCount.count,
      limit: FREE_TIER_LIMITS.savedArticles,
    });
    throw new LimitExceededError('saved articles', FREE_TIER_LIMITS.savedArticles);
  }

  const articleId = data.id ?? createId();
  const now = new Date();

  const {
    title: extractedTitle,
    excerpt,
    content: cleanContent,
  } = await fetchArticleContent(data.url);

  const dbResult = await db
    .insert(articles)
    .values({
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
    })
    .returning();

  const row = dbResult[0];
  assert(row, 'Created article must exist');

  return {
    id: row.id,
    userId: row.userId,
    feedId: row.feedId,
    title: row.title,
    url: row.url,
    description: row.description,
    content: row.content,
    author: row.author,
    pubDate: row.pubDate?.toISOString() ?? null,
    isRead: row.isRead,
    isArchived: row.isArchived,
    cleanContent: row.cleanContent ?? null,
    contentExtractedAt: row.contentExtractedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
