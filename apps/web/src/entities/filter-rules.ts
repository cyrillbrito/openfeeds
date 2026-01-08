import {
  createFilterRule,
  dbProvider,
  deleteFilterRule,
  getAllFilterRules,
  updateFilterRule,
} from '@repo/domain';
import {
  createFilterRuleApiSchema,
  filterRuleSchema,
  updateFilterRuleSchema,
} from '@repo/shared/schemas';
import type { CreateFilterRuleApi, FilterRule } from '@repo/shared/types';
import { eq } from '@tanstack/db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { createServerFn } from '@tanstack/solid-start';
import { queryClient } from '~/query-client';
import { authMiddleware } from '~/server/middleware/auth';
import { z } from 'zod';

const $$getAllFilterRules = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return getAllFilterRules(db);
  });

const $$createFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(createFilterRuleApiSchema.extend({ feedId: z.number() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map(({ feedId, ...rule }) => createFilterRule(feedId, rule, db)));
  });

const $$updateFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(updateFilterRuleSchema.extend({ feedId: z.number(), id: z.number() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(
      data.map(({ feedId, id, ...updates }) => updateFilterRule(feedId, id, updates, db)),
    );
  });

const $$deleteFilterRules = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.object({ feedId: z.number(), id: z.number() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map(({ feedId, id }) => deleteFilterRule(feedId, id, db)));
  });

export const filterRulesCollection = createCollection(
  queryCollectionOptions({
    id: 'filter-rules',
    queryKey: ['filter-rules'],
    queryClient,
    getKey: (item: FilterRule) => item.id,
    schema: filterRuleSchema,
    queryFn: () => $$getAllFilterRules(),

    onInsert: async ({ transaction }) => {
      const rules = transaction.mutations.map((mutation) => {
        const rule = mutation.modified as FilterRule & CreateFilterRuleApi;
        return {
          feedId: rule.feedId,
          pattern: rule.pattern,
          operator: rule.operator,
          isActive: rule.isActive,
        };
      });
      await $$createFilterRules({ data: rules });
    },

    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => {
        const rule = mutation.modified as FilterRule;
        return {
          feedId: rule.feedId,
          id: mutation.key as number,
          ...mutation.changes,
        };
      });
      await $$updateFilterRules({ data: updates });
    },

    onDelete: async ({ transaction }) => {
      const items = transaction.mutations.map((mutation) => {
        const rule = mutation.original as FilterRule;
        return {
          feedId: rule.feedId,
          id: mutation.key as number,
        };
      });
      await $$deleteFilterRules({ data: items });
    },
  }),
);

export function useFilterRules(feedId: number) {
  return useLiveQuery((q) =>
    q.from({ rule: filterRulesCollection }).where(({ rule }) => eq(rule.feedId, feedId)),
  );
}
