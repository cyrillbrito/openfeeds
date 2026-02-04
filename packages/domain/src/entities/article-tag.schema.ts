import { z } from 'zod';

export const ArticleTagSchema = z.object({
  id: z.string(),
  userId: z.string(),
  articleId: z.string(),
  tagId: z.string(),
});
export type ArticleTag = z.infer<typeof ArticleTagSchema>;

/** Schema for creating article tags (id and userId are server-generated) */
export const CreateArticleTagSchema = ArticleTagSchema.omit({
  id: true,
  userId: true,
});
export type CreateArticleTag = z.infer<typeof CreateArticleTagSchema>;
