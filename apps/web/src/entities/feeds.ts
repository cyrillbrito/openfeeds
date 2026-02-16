import { snakeCamelMapper } from '@electric-sql/client';
import { FeedSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { handleCollectionError } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import { $$createFeeds, $$deleteFeeds, $$updateFeeds } from './feeds.server';

// Feeds Collection - Electric-powered real-time sync
export const feedsCollection = createCollection(
  electricCollectionOptions({
    id: 'feeds',
    schema: FeedSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('feeds'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
    },

    onInsert: async ({ transaction }) => {
      try {
        const feeds = transaction.mutations.map((mutation) => {
          const feed = mutation.modified;
          return { id: mutation.key as string, url: feed.url };
        });
        await $$createFeeds({ data: feeds });
      } catch (error) {
        handleCollectionError(error, 'feeds.onInsert');
      }
    },

    onUpdate: async ({ transaction }) => {
      try {
        const updates = transaction.mutations.map((mutation) => ({
          id: mutation.key as string,
          ...mutation.changes,
        }));
        await $$updateFeeds({ data: updates });
      } catch (error) {
        handleCollectionError(error, 'feeds.onUpdate');
      }
    },

    onDelete: async ({ transaction }) => {
      try {
        const ids = transaction.mutations.map((mutation) => mutation.key as string);
        await $$deleteFeeds({ data: ids });
      } catch (error) {
        handleCollectionError(error, 'feeds.onDelete');
      }
    },
  }),
);

export function useFeeds() {
  return useLiveQuery((q) => q.from({ feed: feedsCollection }));
}
