import { snakeCamelMapper } from '@electric-sql/client';
import { filterRuleSchema, type CreateFilterRuleApi, type FilterRule } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, eq, useLiveQuery } from '@tanstack/solid-db';
import { collectionErrorHandler, handleShapeError } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import {
  $$createFilterRules,
  $$deleteFilterRules,
  $$updateFilterRules,
} from './filter-rules.server';

// Filter Rules Collection - Electric-powered real-time sync
export const filterRulesCollection = createCollection(
  electricCollectionOptions({
    id: 'filter-rules',
    schema: filterRuleSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('filter-rules'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: (error) => handleShapeError(error, 'filterRules.shape'),
    },

    onInsert: collectionErrorHandler('filterRules.onInsert', async ({ transaction }) => {
      const rules = transaction.mutations.map((mutation) => {
        const rule = mutation.modified as FilterRule & CreateFilterRuleApi;
        return {
          id: mutation.key as string,
          feedId: rule.feedId,
          pattern: rule.pattern,
          operator: rule.operator,
          isActive: rule.isActive,
        };
      });
      await $$createFilterRules({ data: rules });
    }),

    onUpdate: collectionErrorHandler('filterRules.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => {
        const rule = mutation.modified as FilterRule;
        return {
          feedId: rule.feedId,
          id: mutation.key as string,
          ...mutation.changes,
        };
      });
      await $$updateFilterRules({ data: updates });
    }),

    onDelete: collectionErrorHandler('filterRules.onDelete', async ({ transaction }) => {
      const items = transaction.mutations.map((mutation) => {
        const rule = mutation.original as FilterRule;
        return {
          feedId: rule.feedId,
          id: mutation.key as string,
        };
      });
      await $$deleteFilterRules({ data: items });
    }),
  }),
);

export function useFilterRules(feedId: string) {
  return useLiveQuery((q) =>
    q.from({ rule: filterRulesCollection }).where(({ rule }) => eq(rule.feedId, feedId)),
  );
}
