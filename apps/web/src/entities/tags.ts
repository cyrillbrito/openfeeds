import { TagSchema } from '@repo/shared/schemas';
import type { Tag } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { $$createTags, $$deleteTags, $$getAllTags, $$updateTags } from './tags.server';

// Tags Collection
export const tagsCollection = createCollection(
  queryCollectionOptions({
    id: 'tags',
    queryKey: ['tags'],
    queryClient,
    getKey: (item: Tag) => item.id,
    schema: TagSchema,
    queryFn: async () => (await $$getAllTags()) ?? [],

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
