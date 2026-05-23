import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import {
  createFilterRules,
  CreateFilterRuleSchema,
  deleteFilterRules,
  updateFilterRules,
  UpdateFilterRuleSchema,
  withTransaction,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireUser, type Env } from '~/middleware/auth';

/** Mirror of `apps/web/src/entities/filter-rules.functions.ts`. */
export const filterRulesRoutes = new Hono<Env>()
  .use('*', authMiddleware)
  .post('/create', zValidator('json', z.array(CreateFilterRuleSchema)), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await createFilterRules(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .patch('/update', zValidator('json', z.array(UpdateFilterRuleSchema)), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await updateFilterRules(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/delete', zValidator('json', z.array(z.uuidv7())), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const ids = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await deleteFilterRules(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  });
