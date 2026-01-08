import { dbProvider } from '@repo/domain';
import * as tagsDomain from '@repo/domain';
import { CreateTagSchema, TagSchema, UpdateTagSchema } from '@repo/shared/schemas';
import type { Tag } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { createServerFn } from '@tanstack/solid-start';
import { queryClient } from '~/query-client';
import { authMiddleware } from '~/server/middleware/auth';
import { z } from 'zod';

const $$getAllTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return tagsDomain.getAllTags(db);
  });

const $$createTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateTagSchema))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map((tag) => tagsDomain.createTag(tag, db)));
  });

const $$updateTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateTagSchema.extend({ id: z.number() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map(({ id, ...updates }) => tagsDomain.updateTag(id, updates, db)));
  });

const $$deleteTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.number()))
  .handler(({ context, data: ids }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(ids.map((id) => tagsDomain.deleteTag(id, db)));
  });

// Tags Collection
export const tagsCollection = createCollection(
  queryCollectionOptions({
    id: 'tags',
    queryKey: ['tags'],
    queryClient,
    getKey: (item: Tag) => item.id,
    schema: TagSchema,
    queryFn: () => $$getAllTags(),

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
      const ids = transaction.mutations.map((mutation) => mutation.key as number);
      await $$deleteTags({ data: ids });
    },
  }),
);

export function useTags() {
  return useLiveQuery((q) => q.from({ tag: tagsCollection }));
}
