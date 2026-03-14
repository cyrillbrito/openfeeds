import { articles, db, feeds, filterRules, type Db, type Transaction } from '@repo/db';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { PLAN_LIMITS, type Plan, type UserUsage } from './limits.schema';

// Re-export schema for server barrel
export * from './limits.schema';

export function countUserFeeds(userId: string, conn: Db | Transaction) {
  return conn
    .select({ count: count() })
    .from(feeds)
    .where(eq(feeds.userId, userId))
    .then((r) => r[0]?.count ?? 0);
}

export function countUserFilterRules(userId: string, conn: Db | Transaction) {
  return conn
    .select({ count: count() })
    .from(filterRules)
    .where(eq(filterRules.userId, userId))
    .then((r) => r[0]?.count ?? 0);
}

/** Counts user-created articles only (feedId IS NULL), not feed-synced ones. */
export function countUserSavedArticles(userId: string, conn: Db | Transaction) {
  return conn
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), isNull(articles.feedId)))
    .then((r) => r[0]?.count ?? 0);
}

export function countDailyExtractions(userId: string, conn: Db | Transaction) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return conn
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.contentExtractedAt} >= ${oneDayAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

export function countMonthlyExtractions(userId: string, conn: Db | Transaction) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return conn
    .select({ count: count() })
    .from(articles)
    .where(
      and(eq(articles.userId, userId), sql`${articles.contentExtractedAt} >= ${thirtyDaysAgo}`),
    )
    .then((r) => r[0]?.count ?? 0);
}

export function countDailyTts(userId: string, conn: Db | Transaction) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return conn
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.audioGeneratedAt} >= ${oneDayAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

export function countMonthlyTts(userId: string, conn: Db | Transaction) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return conn
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.audioGeneratedAt} >= ${thirtyDaysAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

// ---------------------------------------------------------------------------
// Aggregate usage for the settings UI
// ---------------------------------------------------------------------------

export async function getUserUsage(userId: string, plan: Plan = 'free'): Promise<UserUsage> {
  const limits = PLAN_LIMITS[plan];

  const [
    feedCount,
    ruleCount,
    savedCount,
    dailyExtractions,
    monthlyExtractions,
    dailyTts,
    monthlyTts,
  ] = await Promise.all([
    countUserFeeds(userId, db),
    countUserFilterRules(userId, db),
    countUserSavedArticles(userId, db),
    countDailyExtractions(userId, db),
    countMonthlyExtractions(userId, db),
    countDailyTts(userId, db),
    countMonthlyTts(userId, db),
  ]);

  return {
    feeds: { used: feedCount, limit: limits.feeds },
    filterRules: { used: ruleCount, limit: limits.filterRules },
    savedArticles: { used: savedCount, limit: limits.savedArticles },
    extractions: {
      daily: { used: dailyExtractions, limit: limits.extractionsPerDay },
      monthly: { used: monthlyExtractions, limit: limits.extractionsPerMonth },
    },
    tts: {
      daily: { used: dailyTts, limit: limits.ttsPerDay },
      monthly: { used: monthlyTts, limit: limits.ttsPerMonth },
    },
  };
}
