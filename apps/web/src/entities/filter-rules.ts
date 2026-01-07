import { filterRuleSchema } from '@repo/shared/schemas';
import type { CreateFilterRuleApi, FilterRule, UpdateFilterRule } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { useApi } from '../hooks/api';
import { generateTempId, getErrorMessage } from './utils';

// Filter Rules Collection Factory
// Since filter rules are scoped per-feed, we create collections dynamically
const filterRulesCollections = new Map<number, ReturnType<typeof createFilterRulesCollection>>();

function createFilterRulesCollection(feedId: number) {
  return createCollection(
    queryCollectionOptions({
      id: `filter-rules-${feedId}`,
      queryKey: ['feeds-filter-rules', feedId],
      queryClient,
      getKey: (item: FilterRule) => item.id,
      schema: filterRuleSchema,
      queryFn: async ({ signal }) => {
        const api = useApi();
        const { data, error } = await api.feeds({ id: feedId }).rules.get({ fetch: { signal } });
        if (error) {
          throw new Error(getErrorMessage(error));
        }
        return data || [];
      },

      onInsert: async ({ transaction }) => {
        const api = useApi();
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            const rule = mutation.modified as FilterRule & CreateFilterRuleApi;
            const { data, error } = await api.feeds({ id: feedId }).rules.post({
              pattern: rule.pattern,
              operator: rule.operator,
              isActive: rule.isActive,
            });
            if (error) {
              throw new Error(getErrorMessage(error));
            }
            return data;
          }),
        );
      },

      onUpdate: async ({ transaction }) => {
        const api = useApi();
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            const rule = mutation.modified as FilterRule;
            const changes = mutation.changes as UpdateFilterRule;
            const { data, error } = await api
              .feeds({ id: feedId })
              .rules({ ruleId: rule.id })
              .put(changes);
            if (error) {
              throw new Error(getErrorMessage(error));
            }
            return data;
          }),
        );
      },

      onDelete: async ({ transaction }) => {
        const api = useApi();
        await Promise.all(
          transaction.mutations.map(async (mutation) => {
            const ruleId = mutation.key as number;
            const { error } = await api.feeds({ id: feedId }).rules({ ruleId }).delete();
            if (error) {
              throw new Error(getErrorMessage(error));
            }
          }),
        );
      },
    }),
  );
}

/**
 * Get the filter rules collection for a specific feed
 */
export function getFilterRulesCollection(feedId: number) {
  if (!filterRulesCollections.has(feedId)) {
    filterRulesCollections.set(feedId, createFilterRulesCollection(feedId));
  }
  return filterRulesCollections.get(feedId)!;
}

/**
 * Hook to get filter rules for a specific feed
 */
export function useFilterRules(feedId: number) {
  const collection = getFilterRulesCollection(feedId);
  return useLiveQuery((q) => q.from({ rule: collection }));
}

/**
 * Create a new filter rule
 * Applies optimistic insert immediately - UI updates via live queries
 */
export function createFilterRule(feedId: number, data: CreateFilterRuleApi): void {
  const collection = getFilterRulesCollection(feedId);
  const tempId = generateTempId();

  collection.insert({
    id: tempId,
    feedId,
    pattern: data.pattern,
    operator: data.operator,
    isActive: data.isActive,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Update an existing filter rule
 * Applies optimistic update immediately - UI updates via live queries
 */
export function updateFilterRule(feedId: number, ruleId: number, changes: UpdateFilterRule): void {
  const collection = getFilterRulesCollection(feedId);

  collection.update(ruleId, (draft) => {
    if (changes.pattern !== undefined) {
      draft.pattern = changes.pattern;
    }
    if (changes.operator !== undefined) {
      draft.operator = changes.operator;
    }
    if (changes.isActive !== undefined) {
      draft.isActive = changes.isActive;
    }
    draft.updatedAt = new Date().toISOString();
  });
}

/**
 * Delete a filter rule
 * Applies optimistic delete immediately - syncs in background
 */
export function deleteFilterRule(feedId: number, ruleId: number): void {
  const collection = getFilterRulesCollection(feedId);
  collection.delete(ruleId);
}
