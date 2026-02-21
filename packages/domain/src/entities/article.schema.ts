import { z } from 'zod';

export const ArticleSchema = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  feedId: z.uuidv7().nullable(),
  title: z.string(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  author: z.string().nullable(),
  pubDate: z.iso.datetime().nullable(),
  isRead: z.boolean().nullable(),
  isArchived: z.boolean().nullable(),
  cleanContent: z.string().nullable(),
  contentExtractedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type Article = z.infer<typeof ArticleSchema>;

/** Schema for creating articles from a URL (not tied to a feed) */
export const CreateArticleFromUrlSchema = z.object({
  id: z.uuidv7().optional(),
  url: z.url(),
});
export type CreateArticleFromUrl = z.infer<typeof CreateArticleFromUrlSchema>;

export const UpdateArticleSchema = z.object({
  id: z.uuidv7(),
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});
export type UpdateArticle = z.infer<typeof UpdateArticleSchema>;
