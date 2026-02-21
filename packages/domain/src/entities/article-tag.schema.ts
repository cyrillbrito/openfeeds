import { z } from 'zod';

export const ArticleTagSchema = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  articleId: z.uuidv7(),
  tagId: z.uuidv7(),
});
export type ArticleTag = z.infer<typeof ArticleTagSchema>;

/** Schema for creating article tags (userId is server-generated, id is optional) */
export const CreateArticleTagSchema = ArticleTagSchema.omit({
  userId: true,
}).extend({
  id: z.uuidv7().optional(),
});
export type CreateArticleTag = z.infer<typeof CreateArticleTagSchema>;
