import { FeedSchema } from '@repo/shared/schemas';
import type { Feed } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { useApi } from '../hooks/api';
import { getErrorMessage } from './utils';

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

      await Promise.all(
        transaction.mutations.map(async (mutation) => {
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
 * Awaits server response to get real feed ID (needed for tag assignment)
 * Returns the created feed with server-generated ID
 */
export async function createFeed(data: { url: string }): Promise<Feed> {
  const api = useApi();

  // Call API directly to get real feed ID (bypasses temp ID issue)
  const { data: feed, error } = await api.feeds.post({ url: data.url });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  if (!feed) {
    throw new Error('Failed to create feed - no data returned');
  }

  // Add the real feed to collection
  feedsCollection.utils.writeInsert(feed);

  return feed;
}

/**
 * Update an existing feed
 * Applies optimistic update immediately - UI updates via live queries
 */
export function updateFeed(
  id: number,
  changes: {
    title?: string;
    description?: string | null;
    url?: string;
    icon?: string | null;
    tags?: number[];
  },
): void {
  feedsCollection.update(id, (draft) => {
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
}

/**
 * Delete a feed
 * Applies optimistic delete immediately - syncs in background
 */
export function deleteFeed(id: number): void {
  feedsCollection.delete(id);
}
