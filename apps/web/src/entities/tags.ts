import { TagSchema } from '@repo/shared/schemas';
import type { Tag, TagColor } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { useApi } from '../hooks/api';
import { generateTempId, getErrorMessage } from './utils';

// Tags Collection
export const tagsCollection = createCollection(
  queryCollectionOptions({
    id: 'tags',
    queryKey: ['tags'],
    queryClient,
    getKey: (item: Tag) => item.id,
    schema: TagSchema,
    queryFn: async ({ signal }) => {
      const api = useApi();
      const { data, error } = await api.tags.get({ fetch: { signal } });
      if (error) {
        throw new Error(getErrorMessage(error));
      }
      return data || [];
    },

    onInsert: async ({ transaction }) => {
      const api = useApi();
      await Promise.all(
        transaction.mutations.map(async (mutation) => {
          const tag = mutation.modified;
          const { data, error } = await api.tags.post({
            name: tag.name,
            color: tag.color,
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
          const tag = mutation.modified as Tag;
          const changes = mutation.changes as { name?: string; color?: TagColor };
          const { data, error } = await api.tags({ id: tag.id }).put(changes);
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
          const tagId = mutation.key as number;
          const { error } = await api.tags({ id: tagId }).delete();
          if (error) {
            throw new Error(getErrorMessage(error));
          }
        }),
      );
    },
  }),
);

export function useTags() {
  return useLiveQuery((q) => q.from({ tag: tagsCollection }));
}

/**
 * Create a new tag
 * Applies optimistic insert immediately - UI updates via live queries
 */
export function createTag(data: { name: string; color?: TagColor }): void {
  const tempId = generateTempId();

  tagsCollection.insert({
    id: tempId,
    name: data.name,
    color: data.color ?? null,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Update an existing tag
 * Applies optimistic update immediately - UI updates via live queries
 */
export function updateTag(id: number, changes: { name?: string; color?: TagColor }): void {
  tagsCollection.update(id, (draft) => {
    if (changes.name) {
      draft.name = changes.name;
    }
    if (changes.color) {
      draft.color = changes.color;
    }
  });
}

/**
 * Delete a tag
 * Applies optimistic delete immediately - syncs in background
 */
export function deleteTag(id: number): void {
  tagsCollection.delete(id);
}
