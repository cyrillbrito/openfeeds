/**
 * User plan types.
 * 'free' — default tier with capped limits.
 * 'pro'  — elevated/unlimited limits (manual assignment for now).
 */
export type Plan = 'free' | 'pro';

/**
 * Per-plan usage limits.
 *
 * Free-tier limits cap resources for non-paying users.
 * Pro limits use `Infinity` — the comparison `count >= Infinity` is always false,
 * so limit checks are effectively bypassed.
 */
export const PLAN_LIMITS = {
  free: {
    /** Maximum number of feed subscriptions per user */
    feeds: 200,

    /** Maximum number of filter rules per user */
    filterRules: 10,

    /** Maximum number of saved articles (user-created from URL, not from feed sync) per user */
    savedArticles: 100,

    /** Maximum content extractions per user per day */
    extractionsPerDay: 30,

    /** Maximum content extractions per user per month (rolling 30 days) */
    extractionsPerMonth: 450,

    /** Maximum TTS audio generations per user per day */
    ttsPerDay: 5,

    /** Maximum TTS audio generations per user per month (rolling 30 days) */
    ttsPerMonth: 30,
  },
  pro: {
    feeds: Infinity,
    filterRules: Infinity,
    savedArticles: Infinity,
    extractionsPerDay: Infinity,
    extractionsPerMonth: Infinity,
    ttsPerDay: Infinity,
    ttsPerMonth: Infinity,
  },
} as const satisfies Record<Plan, Record<string, number>>;

/** @deprecated Use `PLAN_LIMITS.free` instead. Kept for backwards-compatibility. */
export const FREE_TIER_LIMITS = PLAN_LIMITS.free;

export type PlanLimits = (typeof PLAN_LIMITS)[Plan];
export type LimitKey = keyof typeof FREE_TIER_LIMITS;

/** `limit` is `null` when the user's plan has no cap (pro tier). */
export interface UsageBucket {
  used: number;
  limit: number | null;
}

export interface UserUsage {
  feeds: UsageBucket;
  filterRules: UsageBucket;
  savedArticles: UsageBucket;
  extractions: { daily: UsageBucket; monthly: UsageBucket };
  tts: { daily: UsageBucket; monthly: UsageBucket };
}
