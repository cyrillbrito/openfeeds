import { filterRuleSchema } from '@repo/shared/schemas';
import type { CreateFilterRuleApi, FilterRule } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, eq, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import {
  $$createFilterRules,
  $$deleteFilterRules,
  $$getAllFilterRules,
  $$updateFilterRules,
} from './filter-rules.server';

export const filterRulesCollection = createCollection(
  queryCollectionOptions({
    id: 'filter-rules',
    queryKey: ['filter-rules'],
    queryClient,
    getKey: (item: FilterRule) => item.id,
    schema: filterRuleSchema,
    queryFn: async () => (await $$getAllFilterRules()) ?? [],

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
          id: mutation.key as string,
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
          id: mutation.key as string,
        };
      });
      await $$deleteFilterRules({ data: items });
    },
  }),
);

export function useFilterRules(feedId: string) {
  return useLiveQuery((q) =>
    q.from({ rule: filterRulesCollection }).where(({ rule }) => eq(rule.feedId, feedId)),
  );
}
