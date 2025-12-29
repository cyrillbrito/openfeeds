import { z } from 'zod';

export const ArticleTagSchema = z.object({
  id: z.number(),
  articleId: z.number(),
  tagId: z.number(),
});
