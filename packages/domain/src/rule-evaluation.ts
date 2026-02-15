import { articles, db, feeds, filterRules } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { filterRuleDbToApi } from './db-utils';
import { shouldMarkAsRead } from './entities/filter-rule';

/**
 * Evaluates filter rules for a given feed and article title.
 * Returns true if the article should be marked as read based on the rules.
 * Verifies feed ownership via userId.
 */
export async function evaluateFilterRules(
  feedId: string,
  articleTitle: string,
  userId: string,
): Promise<boolean> {
  try {
    // Verify the feed belongs to this user
    const feed = await db.query.feeds.findFirst({
      where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
    });

    if (!feed) {
      return false; // Feed doesn't exist or doesn't belong to user
    }

    // Get all active filter rules for this feed
    const rules = await db.query.filterRules.findMany({
      where: and(eq(filterRules.feedId, feedId), eq(filterRules.isActive, true)),
    });

    if (rules.length === 0) {
      return false;
    }

    // Convert to API format and evaluate
    const apiRules = rules.map(filterRuleDbToApi);
    return shouldMarkAsRead(apiRules, articleTitle);
  } catch (error) {
    console.error('Error evaluating filter rules:', error);
    return false; // Fail safe - don't mark as read if there's an error
  }
}

/**
 * Applies all active filter rules to existing articles for a specific feed.
 * Returns the number of articles that were marked as read.
 * Verifies feed ownership via userId.
 */
export async function applyFilterRulesToExistingArticles(
  feedId: string,
  userId: string,
): Promise<{ articlesProcessed: number; articlesMarkedAsRead: number }> {
  // Verify the feed belongs to this user
  const feed = await db.query.feeds.findFirst({
    where: and(eq(feeds.id, feedId), eq(feeds.userId, userId)),
  });

  if (!feed) {
    return { articlesProcessed: 0, articlesMarkedAsRead: 0 };
  }

  // Get all active filter rules for this feed
  const rules = await db.query.filterRules.findMany({
    where: and(eq(filterRules.feedId, feedId), eq(filterRules.isActive, true)),
  });

  if (rules.length === 0) {
    return { articlesProcessed: 0, articlesMarkedAsRead: 0 };
  }

  // Get all articles for this feed that are not already read (scoped by userId)
  const feedArticles = await db.query.articles.findMany({
    where: and(
      eq(articles.feedId, feedId),
      eq(articles.userId, userId),
      eq(articles.isRead, false),
    ),
  });

  let articlesMarkedAsRead = 0;
  const apiRules = rules.map(filterRuleDbToApi);

  // Apply rules to each article
  for (const article of feedArticles) {
    if (shouldMarkAsRead(apiRules, article.title)) {
      await db
        .update(articles)
        .set({ isRead: true })
        .where(and(eq(articles.id, article.id), eq(articles.userId, userId)));
      articlesMarkedAsRead++;
    }
  }

  return {
    articlesProcessed: feedArticles.length,
    articlesMarkedAsRead,
  };
}

/**
 * Applies filter rules to a single article during sync.
 * This is used when new articles are being added to avoid processing all articles every time.
 */
export async function applyFilterRulesToArticle(
  feedId: string,
  articleTitle: string,
  userId: string,
): Promise<boolean> {
  return evaluateFilterRules(feedId, articleTitle, userId);
}
