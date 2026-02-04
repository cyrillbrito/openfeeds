import { z } from 'zod';
import { CursorQuerySchema } from './common.schema';

/** Base article query fields shared between HTTP and JSON input */
const ArticleQueryBaseFields = {
  feedId: z.string().optional(),
  tagId: z.string().optional(),
  type: z.enum(['all', 'shorts']).default('all').optional(),
  search: z.string().optional(),
  ids: z.array(z.string()).optional(),
  urlLike: z.string().optional(),
};

/** Schema for HTTP query params (stringbool for URL parsing) */
export const ArticleQuerySchema = CursorQuerySchema.extend({
  ...ArticleQueryBaseFields,
  isRead: z.stringbool().optional(),
  isArchived: z.stringbool().optional(),
});
export type ArticleQuery = z.infer<typeof ArticleQuerySchema>;

/** Schema for JSON input (booleans, no cursor pagination) */
export const ArticleQueryInputSchema = z.object({
  ...ArticleQueryBaseFields,
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  limit: z.number().optional(),
});

export const ArticleSchema = z.object({
  id: z.string(),
  feedId: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  author: z.string().nullable(),
  pubDate: z.coerce.date().nullable(),
  isRead: z.boolean().nullable(),
  isArchived: z.boolean().nullable(),
  hasCleanContent: z.boolean(),
  createdAt: z.coerce.date(),
});
export type Article = z.infer<typeof ArticleSchema>;

/** Schema for creating articles from a URL (not tied to a feed) */
export const CreateArticleFromUrlSchema = z.object({
  id: z.string().optional(),
  url: z.url(),
});
export type CreateArticleFromUrl = z.infer<typeof CreateArticleFromUrlSchema>;

export const UpdateArticleSchema = z.object({
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});
export type UpdateArticle = z.infer<typeof UpdateArticleSchema>;

const MarkManyArchivedRequestSchema = z.object({
  context: z.enum(['all', 'feed', 'tag']),
  feedId: z.string().optional(),
  tagId: z.string().optional(),
});
export type MarkManyArchivedRequest = z.infer<typeof MarkManyArchivedRequestSchema>;

const MarkManyArchivedResponseSchema = z.object({
  success: z.boolean(),
  markedCount: z.number(),
  error: z.string().optional(),
});
export type MarkManyArchivedResponse = z.infer<typeof MarkManyArchivedResponseSchema>;

/**
 * Schema for Electric SQL sync - includes raw DB columns.
 * Electric returns snake_case from DB, columnMapper converts to camelCase.
 * `hasCleanContent` is computed client-side based on cleanContent presence.
 */
export const ElectricArticleSchema = z.object({
  id: z.string(),
  feedId: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  author: z.string().nullable(),
  pubDate: z.coerce.date().nullable(),
  isRead: z.boolean().nullable(),
  isArchived: z.boolean().nullable(),
  cleanContent: z.string().nullable(),
  createdAt: z.coerce.date(),
  hasCleanContent: z.boolean().optional().default(false),
});
