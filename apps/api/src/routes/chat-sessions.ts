import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import { deleteChatSession, withTransaction } from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireUser, type Env } from '~/middleware/auth';

/** Mirror of `apps/web/src/entities/chat-sessions.functions.ts`. */
export const chatSessionsRoutes = new Hono<Env>()
  .use('*', authMiddleware)
  .post('/delete', zValidator('json', z.uuidv7()), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const id = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await deleteChatSession(ctx, id);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  });
