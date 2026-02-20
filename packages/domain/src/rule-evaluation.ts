import { articles, db, feeds, filterRules } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { shouldMarkAsRead } from './entities/filter-rule';

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

  // Apply rules to each article
  for (const article of feedArticles) {
    if (shouldMarkAsRead(rules, article.title)) {
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
