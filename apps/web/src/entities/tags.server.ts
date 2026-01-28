import * as tagsDomain from '@repo/domain';
import { CreateTagSchema, UpdateTagSchema } from '@repo/shared/schemas';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return tagsDomain.getAllTags(context.user.id);
  });

export const $$createTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateTagSchema))
  .handler(({ context, data }) => {
    return Promise.all(data.map((tag) => tagsDomain.createTag(tag, context.user.id)));
  });

export const $$updateTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateTagSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    return Promise.all(
      data.map(({ id, ...updates }) => tagsDomain.updateTag(id, updates, context.user.id)),
    );
  });

export const $$deleteTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    return Promise.all(ids.map((id) => tagsDomain.deleteTag(id, context.user.id)));
  });
