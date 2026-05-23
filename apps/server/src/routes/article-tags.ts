import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import {
  createArticleTags,
  CreateArticleTagSchema,
  deleteArticleTags,
  getAllArticleTags,
  withTransaction,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

export const articleTagsRoutes = new Hono<AuthedEnv>()
  .use('*', requireAuthMiddleware)
  .get('/', async (c) => {
    const user = c.var.user;
    const all = await getAllArticleTags(user.id);
    return c.json(all);
  })
  .post('/create', zValidator('json', z.array(CreateArticleTagSchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await createArticleTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/delete', zValidator('json', z.array(z.uuidv7())), async (c) => {
    const user = c.var.user;
    const ids = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await deleteArticleTags(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  });
