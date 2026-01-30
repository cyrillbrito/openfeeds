import { snakeCamelMapper } from '@electric-sql/client';
import { TagSchema } from '@repo/shared/schemas';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { getShapeUrl } from '~/lib/electric-client';
import { $$createTags, $$deleteTags, $$updateTags } from './tags.server';

// Tags Collection - Electric-powered real-time sync
export const tagsCollection = createCollection(
  electricCollectionOptions({
    id: 'tags',
    schema: TagSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('tags'),
      columnMapper: snakeCamelMapper(),
    },

    onInsert: async ({ transaction }) => {
      const tags = transaction.mutations.map((mutation) => {
        const tag = mutation.modified;
        return { name: tag.name, color: tag.color };
      });
      await $$createTags({ data: tags });
    },

    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: mutation.key,
        ...mutation.changes,
      }));
      await $$updateTags({ data: updates });
    },

    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key as string);
      await $$deleteTags({ data: ids });
    },
  }),
);

export function useTags() {
  return useLiveQuery((q) => q.from({ tag: tagsCollection }));
}
