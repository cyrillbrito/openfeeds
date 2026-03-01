import { snakeCamelMapper } from '@electric-sql/client';
import { FilterRuleSchema, type FilterRule } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, eq, useLiveQuery } from '@tanstack/solid-db';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import {
  $$createFilterRules,
  $$deleteFilterRules,
  $$updateFilterRules,
} from './filter-rules.functions';

// Filter Rules Collection - Electric-powered real-time sync
export const filterRulesCollection = createCollection(
  electricCollectionOptions({
    id: 'filter-rules',
    schema: FilterRuleSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('filter-rules'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('filterRules.shape'),
    },

    onInsert: collectionErrorHandler('filterRules.onInsert', async ({ transaction }) => {
      const rules = transaction.mutations.map((mutation) => {
        const rule = mutation.modified as FilterRule;
        return {
          id: mutation.key as string,
          feedId: rule.feedId,
          pattern: rule.pattern,
          operator: rule.operator,
          isActive: rule.isActive,
        };
      });
      return await $$createFilterRules({ data: rules });
    }),

    onUpdate: collectionErrorHandler('filterRules.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: mutation.key as string,
        ...mutation.changes,
      }));
      return await $$updateFilterRules({ data: updates });
    }),

    onDelete: collectionErrorHandler('filterRules.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key as string);
      return await $$deleteFilterRules({ data: ids });
    }),
  }),
);

export function useFilterRules(feedId: string) {
  return useLiveQuery((q) =>
    q.from({ rule: filterRulesCollection }).where(({ rule }) => eq(rule.feedId, feedId)),
  );
}
