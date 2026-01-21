import { z } from 'zod';
import { CursorQuerySchema } from './common';
import { FeedSchema } from './feed';

export const ArticleQuerySchema = CursorQuerySchema.extend({
  feedId: z.string().optional(),
  tagId: z.string().optional(),
  isRead: z.stringbool().optional(),
  isArchived: z.stringbool().optional(),
  type: z.enum(['all', 'shorts']).default('all').optional(),
  search: z.string().optional(),
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
  tags: z.array(z.string()),
  createdAt: z.coerce.date(),
});

export const CreateArticleSchema = z.object({
  feedId: z.string(),
  title: z.string(),
  url: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  guid: z.string().nullable().optional(),
  pubDate: z.string().nullable().optional(),
});

/** Schema for creating articles from a URL (not tied to a feed) */
export const CreateArticleFromUrlSchema = z.object({
  url: z.string().url(),
  tags: z.array(z.string()).optional(),
});

export const UpdateArticleSchema = z.object({
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

// Article with feed information
export const ArticleWithFeedSchema = ArticleSchema.extend({
  feed: FeedSchema,
});

// Bulk operations
export const BulkUpdateArticlesSchema = z.object({
  articleIds: z.array(z.string()),
  updates: z.object({
    isRead: z.boolean().optional(),
  }),
});

// Article stats
export const ArticleStatsSchema = z.object({
  total: z.number(),
  unread: z.number(),
  starred: z.number(),
  byFeed: z.record(z.string(), z.number()),
});

// Mark many as archived (context-aware)
export const MarkManyArchivedRequestSchema = z.object({
  context: z.enum(['all', 'feed', 'tag']),
  feedId: z.string().optional(), // Required when context is 'feed'
  tagId: z.string().optional(), // Required when context is 'tag'
});

export const MarkManyArchivedResponseSchema = z.object({
  success: z.boolean(),
  markedCount: z.number(),
  error: z.string().optional(),
});

// Article with clean content for reader view
export const ArticleWithContentSchema = ArticleSchema.extend({
  cleanContent: z.string().nullable(),
});
