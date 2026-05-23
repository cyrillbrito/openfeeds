import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import {
  createFeedTags,
  CreateFeedTagSchema,
  deleteFeedTags,
  getAllFeedTags,
  withTransaction,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

export const feedTagsRoutes = new Hono<AuthedEnv>()
  .use('*', requireAuthMiddleware)
  .get('/', async (c) => {
    const user = c.var.user;
    const all = await getAllFeedTags(user.id);
    return c.json(all);
  })
  .post('/create', zValidator('json', z.array(CreateFeedTagSchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await createFeedTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/delete', zValidator('json', z.array(z.uuidv7())), async (c) => {
    const user = c.var.user;
    const ids = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await deleteFeedTags(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  });
