import { articles, db, type Db, type Transaction } from '@repo/db';
import { fetchArticleContent } from '@repo/readability/server';
import { createId } from '@repo/shared/utils';
import { and, eq } from 'drizzle-orm';
import { trackEvent } from '../analytics';
import { LimitExceededError, NotFoundError } from '../errors';
import {
  countDailyExtractions,
  countMonthlyExtractions,
  countUserSavedArticles,
  FREE_TIER_LIMITS,
} from '../limits';
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
  const [daily, monthly] = await Promise.all([
    countDailyExtractions(userId, db),
    countMonthlyExtractions(userId, db),
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

export async function updateArticles(
  data: UpdateArticle[],
  userId: string,
  conn: Db | Transaction,
): Promise<void> {
  if (data.length === 0) return;

  await conn.transaction(async (tx) => {
    for (const { id, ...updates } of data) {
      if (Object.keys(updates).length === 0) continue;

      await tx
        .update(articles)
        .set(updates)
        .where(and(eq(articles.id, id), eq(articles.userId, userId)));
    }
  });
}

export async function createArticles(
  data: CreateArticleFromUrl[],
  userId: string,
  conn: Db | Transaction,
): Promise<void> {
  if (data.length === 0) return;

  // Check free-tier saved article limit (only user-created articles, not feed-synced)
  const currentCount = await countUserSavedArticles(userId, conn);
  if (currentCount + data.length > FREE_TIER_LIMITS.savedArticles) {
    trackEvent(userId, 'limits:saved_articles_limit_hit', {
      current_usage: currentCount,
      limit: FREE_TIER_LIMITS.savedArticles,
    });
    throw new LimitExceededError('saved articles', FREE_TIER_LIMITS.savedArticles);
  }

  // Fetch content for all articles in parallel
  const extracted = await Promise.all(
    data.map(async (item) => {
      try {
        const result = await fetchArticleContent(item.url);
        return { url: item.url, id: item.id, ...result };
      } catch {
        return { url: item.url, id: item.id, title: null, excerpt: null, content: null };
      }
    }),
  );

  const now = new Date();

  const values = extracted.map((item) => ({
    id: item.id ?? createId(),
    userId,
    feedId: null,
    title: item.title || item.url,
    description: item.excerpt ?? null,
    url: item.url,
    pubDate: now,
    createdAt: now,
    isRead: false,
    isArchived: false,
    cleanContent: item.content ?? null,
    contentExtractedAt: item.content !== null ? now : null,
  }));

  await conn.insert(articles).values(values);

  for (const item of data) {
    trackEvent(userId, 'articles:article_create', {
      article_url: item.url,
    });
  }
}
