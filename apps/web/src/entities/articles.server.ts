import { db, getTxId } from '@repo/db';
import * as articlesDomain from '@repo/domain';
import { CreateArticleFromUrlSchema, UpdateArticleSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$updateArticles = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateArticleSchema))
  .handler(async ({ context, data }) => {
    return await db.transaction(async (tx) => {
      await articlesDomain.updateArticles(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$createArticle = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(CreateArticleFromUrlSchema)
  .handler(async ({ context, data }) => {
    return await db.transaction(async (tx) => {
      await articlesDomain.createArticle(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$extractArticleContent = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.uuidv7() }))
  .handler(({ context, data }) => {
    return articlesDomain.extractArticleContent(data.id, context.user.id);
  });
