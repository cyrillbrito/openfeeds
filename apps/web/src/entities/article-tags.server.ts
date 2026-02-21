import * as articleTagsDomain from '@repo/domain';
import { CreateArticleTagSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllArticleTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return articleTagsDomain.getAllArticleTags(context.user.id);
  });

export const $$createArticleTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateArticleTagSchema))
  .handler(({ context, data }) => {
    return articleTagsDomain.createArticleTags(data, context.user.id);
  });

export const $$deleteArticleTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(({ context, data: ids }) => {
    return articleTagsDomain.deleteArticleTags(ids, context.user.id);
  });
