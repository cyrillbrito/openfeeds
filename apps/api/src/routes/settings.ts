import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import {
  createDomainContext,
  getSettings,
  getUserUsage,
  performArchiveArticles,
  updateSettings,
  UpdateSettingsSchema,
  withTransaction,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireUser, type Env } from '~/middleware/auth';

/** Mirror of `apps/web/src/entities/settings.functions.ts`. */
export const settingsRoutes = new Hono<Env>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const user = c.var.user;
    requireUser(user);
    const settings = await getSettings(user.id, db);
    return c.json(settings);
  })
  // Settings is a singleton — client sends a single-element array (matches the
  // legacy server-fn contract `z.array(UpdateSettingsSchema)`), we take the
  // first element. Keeps the collection optimistic-mutation pipeline uniform.
  .patch('/update', zValidator('json', z.array(UpdateSettingsSchema)), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const data = c.req.valid('json');
    const updates = data[0] || {};
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await updateSettings(ctx, updates);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/trigger-auto-archive', async (c) => {
    const user = c.var.user;
    requireUser(user);
    const ctx = createDomainContext(db, user.id, user.plan);
    const result = await performArchiveArticles(ctx);
    return c.json(result);
  })
  .get('/usage', async (c) => {
    const user = c.var.user;
    requireUser(user);
    const usage = await getUserUsage(user.id, user.plan);
    return c.json(usage);
  });
