import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import {
  createArticles,
  CreateArticleFromUrlSchema,
  extractArticleContent,
  updateArticles,
  UpdateArticleSchema,
  withTransaction,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

/**
 * Mutation handlers return `{ txid }` so the client's TanStack DB collection
 * can resolve the optimistic transaction once Electric replays the change.
 *
 * Domain errors bubble — see `app.onError` in `src/index.ts`.
 */
export const articlesRoutes = new Hono<AuthedEnv>()
  .use('*', requireAuthMiddleware)
  .post('/create', zValidator('json', z.array(CreateArticleFromUrlSchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await createArticles(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .patch('/update', zValidator('json', z.array(UpdateArticleSchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await updateArticles(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/extract-content', zValidator('json', z.object({ id: z.uuidv7() })), async (c) => {
    const user = c.var.user;
    const { id } = c.req.valid('json');
    const result = await extractArticleContent(id, user.id, user.plan);
    return c.json(result);
  });
