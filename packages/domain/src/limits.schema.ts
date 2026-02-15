/**
 * Free-tier usage limits.
 *
 * These constants define the maximum resources a user can create
 * on the free plan. When paid plans are introduced, these will
 * be replaced by per-user limits based on their subscription tier.
 */
export const FREE_TIER_LIMITS = {
  /** Maximum number of feed subscriptions per user */
  feeds: 100,

  /** Maximum number of filter rules per user */
  filterRules: 10,

  /** Maximum number of saved articles (user-created from URL, not from feed sync) per user */
  savedArticles: 100,

  /** Maximum content extractions per user per hour */
  extractionsPerHour: 60,
} as const;

export type LimitKey = keyof typeof FREE_TIER_LIMITS;

export interface UserUsage {
  feeds: { used: number; limit: number };
  filterRules: { used: number; limit: number };
  savedArticles: { used: number; limit: number };
}
