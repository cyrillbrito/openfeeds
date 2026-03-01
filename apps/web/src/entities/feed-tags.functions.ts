import { db, getTxId } from '@repo/db';
import * as feedTagsDomain from '@repo/domain';
import { CreateFeedTagSchema } from '@repo/domain';
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
    return await db.transaction(async (tx) => {
      await feedTagsDomain.createFeedTags(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$deleteFeedTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await db.transaction(async (tx) => {
      await feedTagsDomain.deleteFeedTags(ids, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });
