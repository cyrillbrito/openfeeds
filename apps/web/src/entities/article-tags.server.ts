import { dbProvider } from '@repo/domain';
import * as articleTagsDomain from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllArticleTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return articleTagsDomain.getAllArticleTags(db);
  });
