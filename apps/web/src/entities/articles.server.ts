import { dbProvider } from '@repo/domain';
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
});

export const $$getArticles = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(ArticleQuerySchema)
  .handler(({ context, data: query }) => {
    const db = dbProvider.userDb(context.user.id);
    return articlesDomain.getArticles(query, db);
  });

export const $$updateArticles = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateArticleSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(
      data.map(({ id, ...updates }) => articlesDomain.updateArticle(id, updates, db)),
    );
  });

export const $$createArticle = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(CreateArticleFromUrlSchema)
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return articlesDomain.createArticle(data, db);
  });
