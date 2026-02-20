// Entity modules - schemas, types, and CRUD functions
export * from './entities/article';
export * from './entities/article-tag';
export * from './entities/feed';
export * from './entities/feed-tag';
export * from './entities/filter-rule';
export * from './entities/settings';
export * from './entities/tag';

// Non-entity domain logic (operations that span multiple entities or do specialized work)
export * from './archive';
export * from './email';
export * from './feed-sync';
export * from './errors';
export * from './export';
export * from './feed-details';
export * from './import';
export * from './rss-fetch';
export * from './rule-evaluation';
export * from './tts';

// Infrastructure
export { shutdownDomain, redisConnection, QUEUE_NAMES } from './config';
export { logger, type LogMetadata } from './logger';
export {
  enqueueFeedDetail,
  enqueueFeedSync,
  initializeScheduledJobs,
  type UserFeedJobData,
  getFeedSyncOrchestratorQueue,
  getSingleFeedSyncQueue,
  getFeedDetailQueue,
  getAutoArchiveQueue,
} from './queues';

// Analytics
export { trackEvent, type ServerAnalyticsEventMap } from './analytics';

// Version
export { setAppVersion, getAppVersion } from './version';
