import { snakeCamelMapper } from '@electric-sql/client';
import { FeedSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { api, unwrap } from '~/lib/api-client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';

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
      onError: shapeErrorHandler('feeds.shape'),
    },

    onInsert: collectionErrorHandler('feeds.onInsert', async ({ transaction }) => {
      const feeds = transaction.mutations.map((mutation) => {
        const feed = mutation.modified;
        return { id: String(mutation.key), feedUrl: feed.feedUrl };
      });
      return await unwrap(api.api.feeds.create.$post({ json: feeds }));
    }),

    onUpdate: collectionErrorHandler('feeds.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: String(mutation.key),
        ...mutation.changes,
      }));
      return await unwrap(api.api.feeds.update.$patch({ json: updates }));
    }),

    onDelete: collectionErrorHandler('feeds.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => String(mutation.key));
      return await unwrap(api.api.feeds.delete.$post({ json: ids }));
    }),
  }),
);

export function useFeeds() {
  return useLiveQuery((q) => q.from({ feed: feedsCollection }));
}
