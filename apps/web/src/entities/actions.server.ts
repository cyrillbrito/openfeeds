import { getUserDb } from '@repo/db';
import * as ruleEvalDomain from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$applyFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ feedId: z.string() }))
  .handler(({ context, data }) => {
    const db = getUserDb(context.user.id);
    return ruleEvalDomain.applyFilterRulesToExistingArticles(db, data.feedId);
  });
