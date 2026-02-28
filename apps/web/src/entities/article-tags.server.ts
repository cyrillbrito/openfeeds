import { db, getTxId } from '@repo/db';
import * as articleTagsDomain from '@repo/domain';
import { CreateArticleTagSchema } from '@repo/domain';
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
    return await db.transaction(async (tx) => {
      await articleTagsDomain.createArticleTags(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$deleteArticleTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await db.transaction(async (tx) => {
      await articleTagsDomain.deleteArticleTags(ids, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });
