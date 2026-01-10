import { articles, filterRules, type UserDb } from '@repo/db';
import { attemptAsyncFn, shouldMarkAsRead } from '@repo/shared/utils';
import { and, eq } from 'drizzle-orm';
import { filterRuleDbToApi } from './db-utils';

export type Database = UserDb;

/**
 * Evaluates filter rules for a given feed and article title.
 * Returns true if the article should be marked as read based on the rules.
 */
export async function evaluateFilterRules(
  db: Database,
  feedId: string,
  articleTitle: string,
): Promise<boolean> {
  const [error, result] = await attemptAsyncFn(async () => {
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
  });

  if (error) {
    console.error('Error evaluating filter rules:', error);
    return false; // Fail safe - don't mark as read if there's an error
  }

  return result;
}

/**
 * Applies all active filter rules to existing articles for a specific feed.
 * Returns the number of articles that were marked as read.
 */
export async function applyFilterRulesToExistingArticles(
  db: Database,
  feedId: string,
): Promise<{ articlesProcessed: number; articlesMarkedAsRead: number }> {
  const [error, result] = await attemptAsyncFn(async () => {
    // Get all active filter rules for this feed
    const rules = await db.query.filterRules.findMany({
      where: and(eq(filterRules.feedId, feedId), eq(filterRules.isActive, true)),
    });

    if (rules.length === 0) {
      return { articlesProcessed: 0, articlesMarkedAsRead: 0 };
    }

    // Get all articles for this feed that are not already read
    const feedArticles = await db.query.articles.findMany({
      where: and(eq(articles.feedId, feedId), eq(articles.isRead, false)),
    });

    let articlesMarkedAsRead = 0;
    const apiRules = rules.map(filterRuleDbToApi);

    // Apply rules to each article
    for (const article of feedArticles) {
      if (shouldMarkAsRead(apiRules, article.title)) {
        await db.update(articles).set({ isRead: true }).where(eq(articles.id, article.id));
        articlesMarkedAsRead++;
      }
    }

    return {
      articlesProcessed: feedArticles.length,
      articlesMarkedAsRead,
    };
  });

  if (error) {
    console.error('Error applying filter rules to existing articles:', error);
    throw error;
  }

  return result;
}

/**
 * Applies filter rules to a single article during sync.
 * This is used when new articles are being added to avoid processing all articles every time.
 */
export async function applyFilterRulesToArticle(
  db: Database,
  feedId: string,
  articleTitle: string,
): Promise<boolean> {
  return evaluateFilterRules(db, feedId, articleTitle);
}
