import { FeedSchema, filterRuleSchema } from '@repo/shared/schemas';
import type {
  CreateFilterRuleApi,
  Feed,
  FilterRule,
  UpdateFeed,
  UpdateFilterRule,
} from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/solid-db';
import { queryClient } from '../routes/__root';
import { useApi } from './api';

// Helper function to extract error message from Elysia error
function getErrorMessage(error: any): string {
  if (typeof error?.value === 'object' && error.value && 'message' in error.value) {
    return error.value.message as string;
  }
  if (typeof error?.value === 'string') {
    return error.value;
  }
  return 'Request failed';
}

// Feeds Collection
export const feedsCollection = createCollection(
  queryCollectionOptions({
    id: 'feeds',
    queryKey: ['feeds'],
    queryClient,
    getKey: (item: Feed) => item.id,
    schema: FeedSchema,
    queryFn: async ({ signal }) => {
      const api = useApi();
      const { data, error } = await api.feeds.get({ fetch: { signal } });
      if (error) {
        throw new Error(getErrorMessage(error));
      }
      return data || [];
    },

    onInsert: async ({ transaction }) => {
      const api = useApi();
      // For feeds, insert is handled via the create mutation
      // This shouldn't be called directly, but if it is, we'll create the feed
      await Promise.all(
        transaction.mutations.map(async (mutation) => {
          const feed = mutation.modified as Feed & { url: string };
          const { data, error } = await api.feeds.post({ url: feed.url });
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
          const feed = mutation.modified as Feed;
          const changes = mutation.changes as UpdateFeed;
          const { data, error } = await api.feeds({ id: feed.id }).put(changes);
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
          const feedId = mutation.key as number;
          const { error } = await api.feeds({ id: feedId }).delete();
          if (error) {
            throw new Error(getErrorMessage(error));
          }
        }),
      );
    },
  }),
);

// Filter Rules Collection Factory
// Since filter rules are per-feed, we create a factory function
const filterRulesCollections = new Map<number, any>();

export function getFilterRulesCollection(feedId: number) {
  if (!filterRulesCollections.has(feedId)) {
    const collection = createCollection(
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

    filterRulesCollections.set(feedId, collection);
  }

  return filterRulesCollections.get(feedId)!;
}
