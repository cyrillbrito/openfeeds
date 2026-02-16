import { snakeCamelMapper } from '@electric-sql/client';
import { FeedSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { collectionErrorHandler, handleShapeError } from '~/lib/collection-errors';
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
      onError: (error) => handleShapeError(error, 'feeds.shape'),
    },

    onInsert: collectionErrorHandler('feeds.onInsert', async ({ transaction }) => {
      // TODO: REMOVE — fake error to test rollback + toast
      throw new Error('[TEST] Fake insert error — feed should rollback from UI');

      const feeds = transaction.mutations.map((mutation) => {
        const feed = mutation.modified;
        return { id: mutation.key as string, url: feed.url };
      });
      await $$createFeeds({ data: feeds });
    }),

    onUpdate: collectionErrorHandler('feeds.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: mutation.key as string,
        ...mutation.changes,
      }));
      await $$updateFeeds({ data: updates });
    }),

    onDelete: collectionErrorHandler('feeds.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key as string);
      await $$deleteFeeds({ data: ids });
    }),
  }),
);

export function useFeeds() {
  return useLiveQuery((q) => q.from({ feed: feedsCollection }));
}
