import { articles, db, feeds, filterRules, type Db, type Transaction } from '@repo/db';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { trackEvent } from './analytics';
import type { DomainContext } from './domain-context';
import { LimitExceededError } from './errors';
import { PLAN_LIMITS, type UserUsage, parsePlan } from './limits.schema';

// Re-export schema for server barrel
export * from './limits.schema';

function countUserFeeds(userId: string, conn: Db | Transaction) {
  return conn
    .select({ count: count() })
    .from(feeds)
    .where(eq(feeds.userId, userId))
    .then((r) => r[0]?.count ?? 0);
}

function countUserFilterRules(userId: string, conn: Db | Transaction) {
  return conn
    .select({ count: count() })
    .from(filterRules)
    .where(eq(filterRules.userId, userId))
    .then((r) => r[0]?.count ?? 0);
}

/** Counts user-created articles only (feedId IS NULL), not feed-synced ones. */
function countUserSavedArticles(userId: string, conn: Db | Transaction) {
  return conn
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), isNull(articles.feedId)))
    .then((r) => r[0]?.count ?? 0);
}

function countDailyExtractions(userId: string, conn: Db | Transaction) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return conn
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.contentExtractedAt} >= ${oneDayAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

function countMonthlyExtractions(userId: string, conn: Db | Transaction) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return conn
    .select({ count: count() })
    .from(articles)
    .where(
      and(eq(articles.userId, userId), sql`${articles.contentExtractedAt} >= ${thirtyDaysAgo}`),
    )
    .then((r) => r[0]?.count ?? 0);
}

function countDailyTts(userId: string, conn: Db | Transaction) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return conn
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.audioGeneratedAt} >= ${oneDayAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

function countMonthlyTts(userId: string, conn: Db | Transaction) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return conn
    .select({ count: count() })
    .from(articles)
    .where(and(eq(articles.userId, userId), sql`${articles.audioGeneratedAt} >= ${thirtyDaysAgo}`))
    .then((r) => r[0]?.count ?? 0);
}

// ---------------------------------------------------------------------------
// Limit enforcement — throws LimitExceededError if the user is over the limit
// ---------------------------------------------------------------------------

/** Throws if adding `count` feeds would exceed the plan's feed limit. */
export async function checkFeedLimit(
  ctx: DomainContext,
  adding: number,
  source: 'create' | 'opml_import',
): Promise<void> {
  const limit = PLAN_LIMITS[ctx.plan].feeds;
  if (limit === null) return;

  const current = await countUserFeeds(ctx.userId, ctx.conn);
  if (current + adding > limit) {
    trackEvent(ctx.userId, 'limits:feeds_limit_hit', {
      source,
      current_usage: current,
      limit,
      plan: ctx.plan,
    });
    throw new LimitExceededError('feeds', limit);
  }
}

/** Throws if adding `count` filter rules would exceed the plan's filter rule limit. */
export async function checkFilterRuleLimit(ctx: DomainContext, adding: number): Promise<void> {
  const limit = PLAN_LIMITS[ctx.plan].filterRules;
  if (limit === null) return;

  const current = await countUserFilterRules(ctx.userId, ctx.conn);
  if (current + adding > limit) {
    trackEvent(ctx.userId, 'limits:filter_rules_limit_hit', {
      current_usage: current,
      limit,
      plan: ctx.plan,
    });
    throw new LimitExceededError('filter rules', limit);
  }
}

/** Throws if adding `count` saved articles would exceed the plan's saved article limit. */
export async function checkSavedArticleLimit(ctx: DomainContext, adding: number): Promise<void> {
  const limit = PLAN_LIMITS[ctx.plan].savedArticles;
  if (limit === null) return;

  const current = await countUserSavedArticles(ctx.userId, ctx.conn);
  if (current + adding > limit) {
    trackEvent(ctx.userId, 'limits:saved_articles_limit_hit', {
      current_usage: current,
      limit,
      plan: ctx.plan,
    });
    throw new LimitExceededError('saved articles', limit);
  }
}

/** Throws if the user has exceeded their daily or monthly content extraction limit. */
export async function checkExtractionLimit(userId: string, plan: string | null | undefined): Promise<void> {
  const limits = PLAN_LIMITS[parsePlan(plan)];
  if (limits.extractionsPerDay === null) return;

  const [daily, monthly] = await Promise.all([
    countDailyExtractions(userId, db),
    countMonthlyExtractions(userId, db),
  ]);

  if (daily >= limits.extractionsPerDay) {
    trackEvent(userId, 'limits:extractions_limit_hit', {
      window: 'daily',
      current_usage: daily,
      limit: limits.extractionsPerDay,
    });
    throw new LimitExceededError('daily content extractions', limits.extractionsPerDay);
  }
  if (limits.extractionsPerMonth !== null && monthly >= limits.extractionsPerMonth) {
    trackEvent(userId, 'limits:extractions_limit_hit', {
      window: 'monthly',
      current_usage: monthly,
      limit: limits.extractionsPerMonth,
    });
    throw new LimitExceededError('monthly content extractions', limits.extractionsPerMonth);
  }
}

/** Throws if the user has exceeded their daily or monthly TTS generation limit. */
export async function checkTtsLimit(userId: string, plan: string | null | undefined): Promise<void> {
  const limits = PLAN_LIMITS[parsePlan(plan)];
  if (limits.ttsPerDay === null) return;

  const [daily, monthly] = await Promise.all([
    countDailyTts(userId, db),
    countMonthlyTts(userId, db),
  ]);

  if (daily >= limits.ttsPerDay) {
    trackEvent(userId, 'limits:tts_limit_hit', {
      window: 'daily',
      current_usage: daily,
      limit: limits.ttsPerDay,
    });
    throw new LimitExceededError('daily TTS generations', limits.ttsPerDay);
  }
  if (limits.ttsPerMonth !== null && monthly >= limits.ttsPerMonth) {
    trackEvent(userId, 'limits:tts_limit_hit', {
      window: 'monthly',
      current_usage: monthly,
      limit: limits.ttsPerMonth,
    });
    throw new LimitExceededError('monthly TTS generations', limits.ttsPerMonth);
  }
}

// ---------------------------------------------------------------------------
// Aggregate usage for the settings UI
// ---------------------------------------------------------------------------

export async function getUserUsage(userId: string, plan: string | null | undefined): Promise<UserUsage> {
  const limits = PLAN_LIMITS[parsePlan(plan)];

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
