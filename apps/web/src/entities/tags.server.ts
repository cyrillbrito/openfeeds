import { db, getTxId } from '@repo/db';
import * as tagsDomain from '@repo/domain';
import { CreateTagSchema, UpdateTagSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateTagSchema))
  .handler(async ({ context, data }) => {
    return await db.transaction(async (tx) => {
      await tagsDomain.createTags(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$updateTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateTagSchema))
  .handler(async ({ context, data }) => {
    return await db.transaction(async (tx) => {
      await tagsDomain.updateTags(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$deleteTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await db.transaction(async (tx) => {
      await tagsDomain.deleteTags(ids, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });
