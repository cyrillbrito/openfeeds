import { TagSchema } from '@repo/shared/schemas';
import type { Tag, TagColor } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { useApi } from '../hooks/api';
import { queryClient } from '../routes/__root';

// Helper function to extract error message from Elysia error
function getErrorMessage(error: any): string {
  if (typeof error?.value === 'object' && error.value && 'message' in error.value) {
    return error.value.message as string;
  }
  if (typeof error?.value === 'string') {
    return error.value;
  }
  return 'Request failed';
}

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
 * Note: Returns void because temp IDs make it difficult to reliably return the created entity.
 * The tag will appear in useTags() once the server responds and refetch completes.
 */
export async function createTag(data: { name: string; color?: TagColor }): Promise<void> {
  const tempId = -(Math.floor(Math.random() * 1000000) + 1);

  const tx = tagsCollection.insert({
    id: tempId,
    name: data.name,
    color: data.color ?? null,
    createdAt: new Date().toISOString(),
  });

  await tx.isPersisted.promise;
}

/**
 * Update an existing tag
 * Returns the updated tag after persistence
 */
export async function updateTag(
  id: number,
  changes: { name?: string; color?: TagColor },
): Promise<Tag> {
  const tx = tagsCollection.update(id, (draft) => {
    if (changes.name) {
      draft.name = changes.name;
    }
    if (changes.color) {
      draft.color = changes.color;
    }
  });

  await tx.isPersisted.promise;

  const updatedTag = tagsCollection.get(id);
  if (!updatedTag) {
    throw new Error('Tag not found after update');
  }

  return updatedTag;
}

/**
 * Delete a tag
 */
export async function deleteTag(id: number): Promise<void> {
  const tx = tagsCollection.delete(id);
  await tx.isPersisted.promise;
}
