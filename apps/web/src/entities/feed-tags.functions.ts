import { db, getTxId } from '@repo/db';
import * as feedTagsDomain from '@repo/domain';
import { CreateFeedTagSchema, withTransaction } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllFeedTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return feedTagsDomain.getAllFeedTags(context.user.id);
  });

export const $$createFeedTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFeedTagSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await feedTagsDomain.createFeedTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$deleteFeedTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await feedTagsDomain.deleteFeedTags(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
  });
