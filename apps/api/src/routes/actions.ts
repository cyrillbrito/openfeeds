import { zValidator } from '@hono/zod-validator';
import { applyFilterRulesToExistingArticles } from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, requireUser, type Env } from '~/middleware/auth';

/** Mirror of `apps/web/src/entities/actions.functions.ts`. */
export const actionsRoutes = new Hono<Env>()
  .use('*', authMiddleware)
  .post('/apply-filter-rules', zValidator('json', z.object({ feedId: z.uuidv7() })), async (c) => {
    const user = c.var.user;
    requireUser(user);
    const { feedId } = c.req.valid('json');
    const result = await applyFilterRulesToExistingArticles(feedId, user.id);
    return c.json(result);
  });
