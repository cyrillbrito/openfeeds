import * as ruleEvalDomain from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$applyFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ feedId: z.uuidv7() }))
  .handler(({ context, data }) => {
    return ruleEvalDomain.applyFilterRulesToExistingArticles(data.feedId, context.user.id);
  });
