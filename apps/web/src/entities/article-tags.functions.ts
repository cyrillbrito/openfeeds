import { db, getTxId } from '@repo/db';
import * as articleTagsDomain from '@repo/domain';
import { CreateArticleTagSchema, withTransaction } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getAllArticleTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return articleTagsDomain.getAllArticleTags(context.user.id);
  });

export const $$createArticleTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateArticleTagSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await articleTagsDomain.createArticleTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$deleteArticleTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await withTransaction(db, context.user.id, async (ctx) => {
      await articleTagsDomain.deleteArticleTags(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
  });
