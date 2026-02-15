/**
 * Client-safe exports - no @repo/db or server-only imports
 * Use this entrypoint for browser/client code
 */
export { type PaginatedResponse, CursorQuerySchema } from './entities/common.schema';
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
} from './entities/article.schema';
export {
  ArticleTagSchema,
  type ArticleTag,
  CreateArticleTagSchema,
  type CreateArticleTag,
} from './entities/article-tag.schema';
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
} from './entities/feed.schema';
export {
  FeedTagSchema,
  type FeedTag,
  CreateFeedTagSchema,
  type CreateFeedTag,
} from './entities/feed-tag.schema';
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
} from './entities/filter-rule.schema';
export {
  SettingsSchema,
  type Settings,
  UpdateSettingsSchema,
  type ArchiveResult,
  DEFAULT_AUTO_ARCHIVE_DAYS,
  getEffectiveAutoArchiveDays,
  isAutoArchiveDaysDefault,
} from './entities/settings.schema';
export {
  type TagColor,
  TagSchema,
  type Tag,
  CreateTagSchema,
  type CreateTag,
  UpdateTagSchema,
  type UpdateTag,
} from './entities/tag.schema';
export {
  WordTimingSchema,
  type WordTiming,
  ArticleAudioMetadataSchema,
  type ArticleAudioMetadata,
} from './entities/tts.schema';
