import { articles, db, feeds, filterRules } from '@repo/db';
import { and, count, eq, isNull } from 'drizzle-orm';
// Import for use in this file
import { FREE_TIER_LIMITS, type UserUsage } from './limits.schema';

// Re-export schema for server barrel
export * from './limits.schema';

export async function getUserUsage(userId: string): Promise<UserUsage> {
  const [feedCount, ruleCount, savedCount] = await Promise.all([
    db
      .select({ count: count() })
      .from(feeds)
      .where(eq(feeds.userId, userId))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(filterRules)
      .where(eq(filterRules.userId, userId))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: count() })
      .from(articles)
      .where(and(eq(articles.userId, userId), isNull(articles.feedId)))
      .then((r) => r[0]?.count ?? 0),
  ]);

  return {
    feeds: { used: feedCount, limit: FREE_TIER_LIMITS.feeds },
    filterRules: { used: ruleCount, limit: FREE_TIER_LIMITS.filterRules },
    savedArticles: { used: savedCount, limit: FREE_TIER_LIMITS.savedArticles },
  };
}
