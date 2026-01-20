import { FeedSchema } from '@repo/shared/schemas';
import type { Feed } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { $$createFeeds, $$deleteFeeds, $$getAllFeeds, $$updateFeeds } from './feeds.server';

// Feeds Collection
export const feedsCollection = createCollection(
  queryCollectionOptions({
    id: 'feeds',
    queryKey: ['feeds'],
    queryClient,
    getKey: (item: Feed) => item.id,
    schema: FeedSchema,
    queryFn: async () => (await $$getAllFeeds()) ?? [],

    onInsert: async ({ transaction }) => {
      const feeds = transaction.mutations.map((mutation) => {
        const feed = mutation.modified;
        return { url: feed.url };
      });
      await $$createFeeds({ data: feeds });
    },

    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: mutation.key as string,
        ...mutation.changes,
      }));
      await $$updateFeeds({ data: updates });
    },

    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key as string);
      await $$deleteFeeds({ data: ids });
    },
  }),
);

export function useFeeds() {
  return useLiveQuery((q) => q.from({ feed: feedsCollection }));
}
