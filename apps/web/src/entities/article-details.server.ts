import { getUserDb } from '@repo/db';
import * as articlesDomain from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getArticleWithContent = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ context, data }) => {
    const db = getUserDb(context.user.id);
    return articlesDomain.getArticleWithContent(data.id, db);
  });
