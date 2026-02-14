import { z } from 'zod';

export const ArticleTagSchema = z.object({
  id: z.string(),
  userId: z.string(),
  articleId: z.string(),
  tagId: z.string(),
});
export type ArticleTag = z.infer<typeof ArticleTagSchema>;

/** Schema for creating article tags (userId is server-generated, id is optional) */
export const CreateArticleTagSchema = ArticleTagSchema.omit({
  userId: true,
}).extend({
  id: z.string().optional(),
});
export type CreateArticleTag = z.infer<typeof CreateArticleTagSchema>;
