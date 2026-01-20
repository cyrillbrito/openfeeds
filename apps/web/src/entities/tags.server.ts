import { dbProvider } from '@repo/domain';
import * as tagsDomain from '@repo/domain';
import { CreateTagSchema, UpdateTagSchema } from '@repo/shared/schemas';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return tagsDomain.getAllTags(db);
  });

export const $$createTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateTagSchema))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map((tag) => tagsDomain.createTag(tag, db)));
  });

export const $$updateTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateTagSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map(({ id, ...updates }) => tagsDomain.updateTag(id, updates, db)));
  });

export const $$deleteTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(ids.map((id) => tagsDomain.deleteTag(id, db)));
  });
