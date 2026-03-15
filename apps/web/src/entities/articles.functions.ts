import { db, getTxId } from '@repo/db';
import * as articlesDomain from '@repo/domain';
import { CreateArticleFromUrlSchema, UpdateArticleSchema, withTransaction } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createArticles = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateArticleFromUrlSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await articlesDomain.createArticles(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$updateArticles = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateArticleSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await articlesDomain.updateArticles(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$extractArticleContent = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.uuidv7() }))
  .handler(({ context, data }) => {
    return articlesDomain.extractArticleContent(
      data.id,
      context.user.id,
      context.user.plan,
    );
  });
