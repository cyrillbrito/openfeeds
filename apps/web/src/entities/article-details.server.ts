import * as articlesDomain from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getArticleWithContent = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ context, data }) => {
    return articlesDomain.getArticleWithContent(data.id, context.user.id);
  });
