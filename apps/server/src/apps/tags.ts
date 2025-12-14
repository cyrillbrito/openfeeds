import { createTag, deleteTag, getAllTags, updateTag } from '@repo/domain';
import { CreateTagSchema, TagSchema, UpdateTagSchema } from '@repo/shared/schemas';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { authPlugin } from '../auth-plugin';
import { errorHandlerPlugin } from '../error-handler-plugin';

export const tagsApp = new Elysia({ prefix: '/tags' })
  .use(errorHandlerPlugin)
  .use(authPlugin)
  .get(
    '/',
    async ({ db }) => {
      const tags = await getAllTags(db);
      return tags;
    },
    {
      response: TagSchema.array(),
      detail: {
        tags: ['Tags'],
        summary: 'List all tags',
      },
    },
  )
  .post(
    '/',
    async ({ body, db, status }) => {
      const newTag = await createTag(body, db);
      return status(201, newTag);
    },
    {
      body: CreateTagSchema,
      response: {
        201: TagSchema,
      },
      detail: {
        tags: ['Tags'],
        summary: 'Create new tag',
      },
    },
  )
  .put(
    '/:id',
    async ({ params, body, db }) => {
      const updatedTag = await updateTag(params.id, body, db);
      return updatedTag;
    },
    {
      params: z.object({ id: z.coerce.number() }),
      body: UpdateTagSchema,
      response: TagSchema,
      detail: {
        tags: ['Tags'],
        summary: 'Update existing tag',
      },
    },
  )
  .delete(
    '/:id',
    async ({ params, db, status }) => {
      await deleteTag(params.id, db);
      return status(204);
    },
    {
      params: z.object({ id: z.coerce.number() }),
      detail: {
        tags: ['Tags'],
        summary: 'Delete tag',
      },
    },
  );
