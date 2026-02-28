import { snakeCamelMapper } from '@electric-sql/client';
import { TagSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import { $$createTags, $$deleteTags, $$updateTags } from './tags.server';

// Tags Collection - Electric-powered real-time sync
export const tagsCollection = createCollection(
  electricCollectionOptions({
    id: 'tags',
    schema: TagSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('tags'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('tags.shape'),
    },

    onInsert: collectionErrorHandler('tags.onInsert', async ({ transaction }) => {
      const tags = transaction.mutations.map((mutation) => {
        const tag = mutation.modified;
        return { id: mutation.key as string, name: tag.name, color: tag.color };
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
  return useLiveQuery((q) => q.from({ tag: tagsCollection }));
}
