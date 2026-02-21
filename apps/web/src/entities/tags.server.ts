import * as tagsDomain from '@repo/domain';
import { CreateTagSchema, UpdateTagSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateTagSchema))
  .handler(({ context, data }) => {
    return tagsDomain.createTags(data, context.user.id);
  });

export const $$updateTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateTagSchema))
  .handler(({ context, data }) => {
    return tagsDomain.updateTags(data, context.user.id);
  });

export const $$deleteTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(({ context, data: ids }) => {
    return tagsDomain.deleteTags(ids, context.user.id);
  });
