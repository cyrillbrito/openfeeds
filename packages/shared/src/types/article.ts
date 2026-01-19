import type { z } from 'zod';
import type {
  ArticleQuerySchema,
  ArticleSchema,
  ArticleStatsSchema,
  ArticleWithContentSchema,
  ArticleWithFeedSchema,
  BulkUpdateArticlesSchema,
  CreateArticleSchema,
  CreateStandaloneArticleSchema,
  MarkManyArchivedRequestSchema,
  MarkManyArchivedResponseSchema,
  UpdateArticleSchema,
} from '../schemas/article';

export type ArticleQuery = z.infer<typeof ArticleQuerySchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type ArticleWithContent = z.infer<typeof ArticleWithContentSchema>;
export type CreateArticle = z.infer<typeof CreateArticleSchema>;
export type CreateStandaloneArticle = z.infer<typeof CreateStandaloneArticleSchema>;
export type UpdateArticle = z.infer<typeof UpdateArticleSchema>;
export type ArticleWithFeed = z.infer<typeof ArticleWithFeedSchema>;
export type BulkUpdateArticles = z.infer<typeof BulkUpdateArticlesSchema>;
export type ArticleStats = z.infer<typeof ArticleStatsSchema>;
export type MarkManyArchivedRequest = z.infer<typeof MarkManyArchivedRequestSchema>;
export type MarkManyArchivedResponse = z.infer<typeof MarkManyArchivedResponseSchema>;

// Read status filter type
export type ArticleTypeFilter = 'all' | 'shorts';
