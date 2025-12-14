import type { z } from 'zod';
import type {
  ArticleQuerySchema,
  ArticleSchema,
  ArticleStatsSchema,
  ArticleWithContentSchema,
  ArticleWithFeedSchema,
  BulkUpdateArticlesSchema,
  CreateArticleSchema,
  MarkManyReadRequestSchema,
  MarkManyReadResponseSchema,
  UpdateArticleSchema,
} from '../schemas/article';

export type ArticleQuery = z.infer<typeof ArticleQuerySchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type ArticleWithContent = z.infer<typeof ArticleWithContentSchema>;
export type CreateArticle = z.infer<typeof CreateArticleSchema>;
export type UpdateArticle = z.infer<typeof UpdateArticleSchema>;
export type ArticleWithFeed = z.infer<typeof ArticleWithFeedSchema>;
export type BulkUpdateArticles = z.infer<typeof BulkUpdateArticlesSchema>;
export type ArticleStats = z.infer<typeof ArticleStatsSchema>;
export type MarkManyReadRequest = z.infer<typeof MarkManyReadRequestSchema>;
export type MarkManyReadResponse = z.infer<typeof MarkManyReadResponseSchema>;

// Read status filter type
export type ArticleTypeFilter = 'all' | 'shorts';
