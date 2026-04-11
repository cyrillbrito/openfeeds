import { db, getTxId } from '@repo/db';
import * as domain from '@repo/domain';
import { SaveChatSessionSchema, withTransaction } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

/** Create or update a session (upsert) */
export const $$saveChatSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(SaveChatSessionSchema)
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await domain.saveChatSession(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

/** Delete a session */
export const $$deleteChatSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await domain.deleteChatSession(ctx, data.id);
      return { txid: await getTxId(ctx.conn) };
    });
  });
