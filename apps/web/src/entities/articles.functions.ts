import { db, getTxId } from '@repo/db';
import * as articlesDomain from '@repo/domain';
import { CreateArticleFromUrlSchema, UpdateArticleSchema, withTransaction } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { getRequestHeader } from '@tanstack/solid-start/server';
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
    // Correlate with client-side mutation lifecycle logs. Header is
    // emitted by `collectionErrorHandler` (see articles.ts onUpdate).
    const mutationId = getRequestHeader('x-mutation-id');
    const changedFields = Array.from(
      new Set(data.flatMap((row) => Object.keys(row).filter((k) => k !== 'id'))),
    );

    const result = await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await articlesDomain.updateArticles(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });

    // eslint-disable-next-line no-console
    console.info('[server:articles.update]', {
      mutationId,
      txid: result.txid,
      userId: context.user.id,
      articleIds: data.map((row) => row.id),
      articleCount: data.length,
      changedFields,
    });

    return result;
  });

export const $$extractArticleContent = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.uuidv7() }))
  .handler(({ context, data }) => {
    return articlesDomain.extractArticleContent(data.id, context.user.id, context.user.plan);
  });
