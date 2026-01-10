import { z } from 'zod';

export const ArticleTagSchema = z.object({
  id: z.string(),
  articleId: z.string(),
  tagId: z.string(),
});
