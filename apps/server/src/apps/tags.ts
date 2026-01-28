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
    async ({ user }) => {
      const tags = await getAllTags(user.id);
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
    async ({ body, user, status }) => {
      const newTag = await createTag(body, user.id);
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
    async ({ params, body, user }) => {
      const updatedTag = await updateTag(params.id, body, user.id);
      return updatedTag;
    },
    {
      params: z.object({ id: z.string() }),
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
    async ({ params, status, user }) => {
      await deleteTag(params.id, user.id);
      return status(204);
    },
    {
      params: z.object({ id: z.string() }),
      detail: {
        tags: ['Tags'],
        summary: 'Delete tag',
      },
    },
  );
