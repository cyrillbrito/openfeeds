import * as articlesDomain from '@repo/domain';
import {
  ArticleQueryInputSchema,
  CreateArticleFromUrlSchema,
  UpdateArticleSchema,
} from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getArticles = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(ArticleQueryInputSchema)
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

export const $$extractArticleContent = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ context, data }) => {
    return articlesDomain.extractArticleContent(data.id, context.user.id);
  });
