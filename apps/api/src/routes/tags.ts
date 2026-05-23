import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import {
  createTags,
  CreateTagSchema,
  deleteTags,
  updateTags,
  UpdateTagSchema,
  withTransaction,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireUser, type Env } from '~/middleware/auth';

/** Mirror of `apps/web/src/entities/tags.functions.ts`. */
export const tagsRoutes = new Hono<Env>()
  .use('*', authMiddleware)
  .post('/create', zValidator('json', z.array(CreateTagSchema)), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await createTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .patch('/update', zValidator('json', z.array(UpdateTagSchema)), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await updateTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/delete', zValidator('json', z.array(z.uuidv7())), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const ids = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await deleteTags(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  });
