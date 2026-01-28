import * as articlesDomain from '@repo/domain';
import { CreateArticleFromUrlSchema, UpdateArticleSchema } from '@repo/shared/schemas';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

const ArticleQuerySchema = z.object({
  feedId: z.string().optional(),
  tagId: z.string().optional(),
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  type: z.enum(['all', 'shorts']).optional(),
  limit: z.number().optional(),
  ids: z.array(z.string()).optional(),
  urlLike: z.string().optional(),
});

export const $$getArticles = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(ArticleQuerySchema)
  .handler(({ context, data: query }) => {
    return articlesDomain.getArticles(query, context.user.id);
  });

export const $$updateArticles = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateArticleSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    return Promise.all(
      data.map(({ id, ...updates }) => articlesDomain.updateArticle(id, updates, context.user.id)),
    );
  });

export const $$createArticle = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(CreateArticleFromUrlSchema)
  .handler(({ context, data }) => {
    return articlesDomain.createArticle(data, context.user.id);
  });
