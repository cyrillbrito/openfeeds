/**
 * Client-safe exports - no @repo/db or server-only imports
 * Use this entrypoint for browser/client code
 */
export * from './entities/article.schema';
export * from './entities/article-tag.schema';
export * from './entities/feed.schema';
export * from './entities/feed-tag.schema';
export * from './entities/filter-rule.schema';
export * from './entities/settings.schema';
export * from './entities/tag.schema';
export * from './entities/tts.schema';

// Client-safe error utilities (no DB imports)
export { isLimitExceededError, getLimitErrorMessage } from './errors';

// Limits config (pure constants + types)
export { FREE_TIER_LIMITS, type LimitKey, type UserUsage } from './limits.schema';
