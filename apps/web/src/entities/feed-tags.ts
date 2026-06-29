import { snakeCamelMapper } from '@electric-sql/client';
import { FeedTagSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection, useLiveQuery } from '@tanstack/react-db';
import { api, unwrap } from '~/lib/api-client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl } from '~/lib/electric-client';

// Feed Tags Collection (junction table for local-first joins) - Electric-powered real-time sync
export const feedTagsCollection = createCollection(
  electricCollectionOptions({
    id: 'feed-tags',
    schema: FeedTagSchema,
    getKey: (item) => item.id,

    // autoIndex: 'eager' restores the pre-0.6 default, which was changed to 'off'.
    // It auto-creates B-tree indexes for fields used in orderBy/where at query time.
    // TODO: consider switching to explicit createIndex calls per field for more control
    //       over memory usage (avoids surprise indexes from transient queries).
    autoIndex: 'eager' as const,
    defaultIndexType: BasicIndex,

    shapeOptions: {
      url: getShapeUrl('feed-tags'),
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('feedTags.shape'),
    },

    onInsert: collectionErrorHandler('feedTags.onInsert', async ({ transaction }) => {
      const tags = transaction.mutations.map((mutation) => {
        const tag = mutation.modified;
        return { id: String(mutation.key), feedId: tag.feedId, tagId: tag.tagId };
      });
      return await unwrap(api.api['feed-tags'].create.$post({ json: tags }));
    }),

    onDelete: collectionErrorHandler('feedTags.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => String(mutation.key));
      return await unwrap(api.api['feed-tags'].delete.$post({ json: ids }));
    }),
  }),
);

export function useFeedTags() {
  const { data } = useLiveQuery((q) => q.from({ feedTag: feedTagsCollection }));
  return data ?? [];
}
