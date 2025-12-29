import type { z } from 'zod';
import type { ArticleTagSchema } from '../schemas/article-tag';

export type ArticleTag = z.infer<typeof ArticleTagSchema>;
