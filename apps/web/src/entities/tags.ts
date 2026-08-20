import { snakeCamelMapper } from '@electric-sql/client';
import { TagSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection, useLiveQuery } from '@tanstack/react-db';
import { api, unwrap } from '~/lib/api-client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';

// Tags Collection - Electric-powered real-time sync
export const tagsCollection = createCollection(
  electricCollectionOptions({
    id: 'tags',
    schema: TagSchema,
    getKey: (item) => item.id,

    // autoIndex: 'eager' restores the pre-0.6 default, which was changed to 'off'.
    // It auto-creates B-tree indexes for fields used in orderBy/where at query time.
    // TODO: consider switching to explicit createIndex calls per field for more control
    //       over memory usage (avoids surprise indexes from transient queries).
    autoIndex: 'eager' as const,
    defaultIndexType: BasicIndex,

    shapeOptions: {
      url: getShapeUrl('tags'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('tags.shape'),
    },

    onInsert: collectionErrorHandler('tags.onInsert', async ({ transaction }) => {
      const tags = transaction.mutations.map((mutation) => {
        const tag = mutation.modified;
        return { id: String(mutation.key), name: tag.name, color: tag.color, order: tag.order };
      });
      return await unwrap(api.api.tags.create.$post({ json: tags }));
    }),

    onUpdate: collectionErrorHandler('tags.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: String(mutation.key),
        ...mutation.changes,
      }));
      return await unwrap(api.api.tags.update.$patch({ json: updates }));
    }),

    onDelete: collectionErrorHandler('tags.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => String(mutation.key));
      return await unwrap(api.api.tags.delete.$post({ json: ids }));
    }),
  }),
);

export function useTags() {
  const { data } = useLiveQuery((q) =>
    q.from({ tag: tagsCollection }).orderBy(({ tag }) => tag.order, 'asc'),
  );
  return data ?? [];
}
