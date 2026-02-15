// Entity modules - schemas, types, and CRUD functions
export {
  ArticleQuerySchema,
  type ArticleQuery,
  ArticleQueryInputSchema,
  ArticleSchema,
  type Article,
  CreateArticleFromUrlSchema,
  type CreateArticleFromUrl,
  UpdateArticleSchema,
  type UpdateArticle,
  type MarkManyArchivedRequest,
  type MarkManyArchivedResponse,
  ElectricArticleSchema,
  getArticles,
  getArticleById,
  getArticleWithContent,
  extractArticleContent,
  updateArticle,
  markManyArticlesArchived,
  createArticle,
} from './entities/article';
export {
  ArticleTagSchema,
  type ArticleTag,
  CreateArticleTagSchema,
  type CreateArticleTag,
  getAllArticleTags,
  createArticleTags,
  deleteArticleTags,
} from './entities/article-tag';
export { type PaginatedResponse, CursorQuerySchema } from './entities/common';
export {
  SyncStatusSchema,
  type SyncStatus,
  FeedSchema,
  type Feed,
  CreateFeedSchema,
  type CreateFeed,
  UpdateFeedSchema,
  type UpdateFeed,
  DiscoveredFeedSchema,
  type DiscoveredFeed,
  getAllFeeds,
  getFeedById,
  createFeed,
  updateFeed,
  deleteFeed,
  retryFeed,
  discoverRssFeeds,
} from './entities/feed';
export {
  FeedTagSchema,
  type FeedTag,
  CreateFeedTagSchema,
  type CreateFeedTag,
  getAllFeedTags,
  createFeedTags,
  deleteFeedTags,
} from './entities/feed-tag';
export {
  FilterOperator,
  filterRuleSchema,
  type FilterRule,
  createFilterRuleApiSchema,
  type CreateFilterRuleApi,
  updateFilterRuleSchema,
  type UpdateFilterRule,
  evaluateRule,
  shouldMarkAsRead,
  getAllFilterRules,
  getFilterRulesByFeedId,
  createFilterRule,
  updateFilterRule,
  deleteFilterRule,
  applyFilterRulesToFeed,
} from './entities/filter-rule';
export {
  SettingsSchema,
  type Settings,
  UpdateSettingsSchema,
  type ArchiveResult,
  DEFAULT_AUTO_ARCHIVE_DAYS,
  getEffectiveAutoArchiveDays,
  isAutoArchiveDaysDefault,
  createSettings,
  getSettings,
  updateSettings,
  getAutoArchiveCutoffDate,
} from './entities/settings';
export {
  type TagColor,
  TagSchema,
  type Tag,
  CreateTagSchema,
  type CreateTag,
  UpdateTagSchema,
  type UpdateTag,
  getAllTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
} from './entities/tag';

// Non-entity domain logic (operations that span multiple entities or do specialized work)
export { autoArchiveArticles, performArchiveArticles } from './archive';
export { sendVerificationEmail, sendPasswordResetEmail } from './email';
export {
  syncFeedArticles,
  syncSingleFeed,
  enqueueStaleFeeds,
  autoArchiveForAllUsers,
} from './feed-sync';
export {
  NotFoundError,
  BadRequestError,
  ConflictError,
  UnexpectedError,
  AssertionError,
  UnauthorizedError,
  TtsNotConfiguredError,
  assert,
} from './errors';
export { exportOpmlFeeds } from './export';
export { fetchFeedMetadata, updateFeedMetadata } from './feed-details';
export { type ImportResult, importOpmlFeeds } from './import';
export { type ParseFeedResult, fetchRss } from './rss-fetch';
export { applyFilterRulesToExistingArticles } from './rule-evaluation';
export {
  WordTimingSchema,
  type WordTiming,
  ArticleAudioMetadataSchema,
  type ArticleAudioMetadata,
  isTtsConfigured,
  articleAudioExists,
  getArticleAudioMetadata,
  getArticleAudioBuffer,
  generateArticleAudio,
} from './tts';

// Utilities
export { isoToDate, articleDbToApi, feedDbToApi, tagDbToApi, filterRuleDbToApi } from './db-utils';

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
export { trackEvent, trackSystemEvent, type ServerAnalyticsEventMap } from './analytics';
