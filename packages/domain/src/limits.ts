import { articles, db, feeds, filterRules } from '@repo/db';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { FREE_TIER_LIMITS, type UserUsage } from './limits.schema';

// Re-export schema for server barrel
export * from './limits.schema';

export function countUserFeeds(userId: string) {
  return db
    .select({ count: count() })
    .from(feeds)
    .where(eq(feeds.userId, userId))
    .then((r) => r[0]?.count ?? 0);
}

export function countUserFilterRules(userId: string) {
  return db
    .select({ count: count() })
    .from(filterRules)
    .where(eq(filterRules.userId, userId))
    .then((r) => r[0]?.count ?? 0);
}

/** Counts user-created articles only (feedId IS NULL), not feed-synced ones. */
export function countUserSavedArticles(userId: string) {
  return db
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), isNull(articles.feedId)))
    .then((r) => r[0]?.count ?? 0);
}

export function countDailyExtractions(userId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.contentExtractedAt} >= ${oneDayAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

export function countMonthlyExtractions(userId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db
    .select({ count: count() })
    .from(articles)
    .where(
      and(eq(articles.userId, userId), sql`${articles.contentExtractedAt} >= ${thirtyDaysAgo}`),
    )
    .then((r) => r[0]?.count ?? 0);
}

export function countDailyTts(userId: string) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.audioGeneratedAt} >= ${oneDayAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

export function countMonthlyTts(userId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return db
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.audioGeneratedAt} >= ${thirtyDaysAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

// ---------------------------------------------------------------------------
// Aggregate usage for the settings UI
// ---------------------------------------------------------------------------

export async function getUserUsage(userId: string): Promise<UserUsage> {
  const [
    feedCount,
    ruleCount,
    savedCount,
    dailyExtractions,
    monthlyExtractions,
    dailyTts,
    monthlyTts,
  ] = await Promise.all([
    countUserFeeds(userId),
    countUserFilterRules(userId),
    countUserSavedArticles(userId),
    countDailyExtractions(userId),
    countMonthlyExtractions(userId),
    countDailyTts(userId),
    countMonthlyTts(userId),
  ]);

  return {
    feeds: { used: feedCount, limit: FREE_TIER_LIMITS.feeds },
    filterRules: { used: ruleCount, limit: FREE_TIER_LIMITS.filterRules },
    savedArticles: { used: savedCount, limit: FREE_TIER_LIMITS.savedArticles },
    extractions: {
      daily: { used: dailyExtractions, limit: FREE_TIER_LIMITS.extractionsPerDay },
      monthly: { used: monthlyExtractions, limit: FREE_TIER_LIMITS.extractionsPerMonth },
    },
    tts: {
      daily: { used: dailyTts, limit: FREE_TIER_LIMITS.ttsPerDay },
      monthly: { used: monthlyTts, limit: FREE_TIER_LIMITS.ttsPerMonth },
    },
  };
}
