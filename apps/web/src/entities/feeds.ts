import { FeedSchema } from '@repo/shared/schemas';
import type { Feed } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { useApi } from '../hooks/api';
import { queryClient } from '../routes/__root';
import { generateTempId, getErrorMessage } from './utils';

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

      console.log('transaction', transaction);
      await Promise.all(
        transaction.mutations.map(async (mutation) => {
          console.log(mutation);
          const feed = mutation.modified;
          const { data, error } = await api.feeds.post({
            url: feed.url,
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
          const feed = mutation.modified as Feed;
          const changes = mutation.changes as {
            title?: string;
            description?: string | null;
            url?: string;
            icon?: string | null;
            tags?: number[];
          };
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

export function useFeeds() {
  return useLiveQuery((q) => q.from({ feed: feedsCollection }));
}

/**
 * Create a new feed
 * Note: Returns void because temp IDs make it difficult to reliably return the created entity.
 * The feed will appear in useFeeds() once the server responds and refetch completes.
 */
export async function createFeed(data: { url: string }): Promise<void> {
  const tempId = generateTempId();

  const tx = feedsCollection.insert({
    id: tempId,
    url: data.url,
    feedUrl: data.url, // Will be updated by server
    title: 'Loading...', // Placeholder
    description: null,
    icon: null,
    createdAt: new Date().toISOString(),
    lastSyncAt: null,
    tags: [],
  });

  await tx.isPersisted.promise;
}

/**
 * Update an existing feed
 * Returns the updated feed after persistence
 */
export async function updateFeed(
  id: number,
  changes: {
    title?: string;
    description?: string | null;
    url?: string;
    icon?: string | null;
    tags?: number[];
  },
): Promise<Feed> {
  const tx = feedsCollection.update(id, (draft) => {
    if (changes.title !== undefined) {
      draft.title = changes.title;
    }
    if (changes.description !== undefined) {
      draft.description = changes.description;
    }
    if (changes.url !== undefined) {
      draft.url = changes.url;
    }
    if (changes.icon !== undefined) {
      draft.icon = changes.icon;
    }
    if (changes.tags !== undefined) {
      draft.tags = changes.tags;
    }
  });

  await tx.isPersisted.promise;

  const updatedFeed = feedsCollection.get(id);
  if (!updatedFeed) {
    throw new Error('Feed not found after update');
  }

  return updatedFeed;
}

/**
 * Delete a feed
 */
export async function deleteFeed(id: number): Promise<void> {
  const tx = feedsCollection.delete(id);
  await tx.isPersisted.promise;
}
