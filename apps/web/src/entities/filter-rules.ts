import { snakeCamelMapper } from '@electric-sql/client';
import { FilterRuleSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, eq, useLiveQuery } from '@tanstack/solid-db';
import { api, unwrap } from '~/lib/api-client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';

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
        const rule = mutation.modified;
        return {
          id: String(mutation.key),
          feedId: rule.feedId,
          pattern: rule.pattern,
          operator: rule.operator,
          isActive: rule.isActive,
        };
      });
      return await unwrap(api.api['filter-rules'].create.$post({ json: rules }));
    }),

    onUpdate: collectionErrorHandler('filterRules.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: String(mutation.key),
        ...mutation.changes,
      }));
      return await unwrap(api.api['filter-rules'].update.$patch({ json: updates }));
    }),

    onDelete: collectionErrorHandler('filterRules.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => String(mutation.key));
      return await unwrap(api.api['filter-rules'].delete.$post({ json: ids }));
    }),
  }),
);

export function useFilterRules(feedId: string) {
  return useLiveQuery((q) =>
    q.from({ rule: filterRulesCollection }).where(({ rule }) => eq(rule.feedId, feedId)),
  );
}
