import { db, getTxId } from '@repo/db';
import * as domain from '@repo/domain';
import { withTransaction } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

/** Delete a session */
export const $$deleteChatSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.uuidv7())
  .handler(async ({ context, data: id }) => {
    return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await domain.deleteChatSession(ctx, id);
      return { txid: await getTxId(ctx.conn) };
    });
  });
