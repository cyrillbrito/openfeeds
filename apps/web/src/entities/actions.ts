import { dbProvider } from '@repo/domain';
import * as ruleEvalDomain from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { authMiddleware } from '~/server/middleware/auth';
import { z } from 'zod';
import { articlesCollection } from './articles';

const $$applyFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ feedId: z.string() }))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return ruleEvalDomain.applyFilterRulesToExistingArticles(db, data.feedId);
  });

/**
 * Apply filter rules to existing articles in a feed
 * This marks articles as read based on the configured rules
 */
export async function applyFilterRules(
  feedId: string,
): Promise<{ articlesProcessed: number; articlesMarkedAsRead: number }> {
  const result = await $$applyFilterRules({ data: { feedId } });

  // Refetch articles to reflect the updated read status
  articlesCollection.utils.refetch();

  return result;
}
