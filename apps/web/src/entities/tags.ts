import { snakeCamelMapper } from '@electric-sql/client';
import { TagSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection, useLiveQuery } from '@tanstack/solid-db';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import { $$createTags, $$deleteTags, $$updateTags } from './tags.functions';

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
        return { id: mutation.key as string, name: tag.name, color: tag.color, order: tag.order };
      });
      return await $$createTags({ data: tags });
    }),

    onUpdate: collectionErrorHandler('tags.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: mutation.key,
        ...mutation.changes,
      }));
      return await $$updateTags({ data: updates });
    }),

    onDelete: collectionErrorHandler('tags.onDelete', async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key as string);
      return await $$deleteTags({ data: ids });
    }),
  }),
);

export function useTags() {
  return useLiveQuery((q) =>
    q.from({ tag: tagsCollection }).orderBy(({ tag }) => tag.order, 'asc'),
  );
}
