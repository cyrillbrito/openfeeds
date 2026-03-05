import { db, getTxId } from '@repo/db';
import * as tagsDomain from '@repo/domain';
import { CreateTagSchema, UpdateTagSchema, withTransaction } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateTagSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await tagsDomain.createTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$updateTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateTagSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await tagsDomain.updateTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$deleteTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await tagsDomain.deleteTags(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
  });
