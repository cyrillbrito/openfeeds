import { zValidator } from '@hono/zod-validator';
import { db, feeds, getTxId } from '@repo/db';
import {
  CreateFeedSchema,
  createFeeds,
  deleteFeeds,
  discoverRssFeeds,
  exportOpmlFeeds,
  feedUrlSchema,
  followFeedsWithTags,
  FollowFeedsWithTagsSchema,
  getFeedSyncLogs,
  importOpmlFeeds,
  retryFeed,
  updateFeeds,
  UpdateFeedSchema,
  withTransaction,
} from '@repo/domain';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { env } from '~/env';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

/**
 * Feed routes.
 *
 * Most handlers are internal: they take/return shapes tailored to the web
 * client's TanStack DB optimistic-mutation handshake (batched input,
 * `{ txid }` response). Errors bubble — `app.onError` in `src/index.ts`
 * maps domain errors to HTTP.
 *
 * One handler is intentionally cross-origin-shaped: `POST /` (i.e.
 * `POST /api/feeds`). It takes a single `{ url }` and returns the created
 * feed row — the standard public-API shape, usable from the browser
 * extension. It is still session-authed (Better Auth cookie required); the
 * "public" label here means "accepts cross-origin credentialed requests
 * from a pinned allowlist", not "anonymous".
 *
 * It carries its own CORS middleware that widens the global policy to
 * also allow the specific extension origins listed in `EXTENSION_ORIGINS`
 * (the top-level CORS in src/index.ts only permits TRUSTED_ORIGINS).
 * `chrome-extension://*` wildcards are intentionally NOT accepted —
 * pinning by extension id stops any other installed extension from
 * piggybacking on the user's session cookie.
 */
function isLocalhostOrigin(origin: string): boolean {
  if (env.NODE_ENV === 'production') return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

const publicCors = cors({
  origin: (origin) => {
    if (!origin) return null;
    if (
      env.EXTENSION_ORIGINS.includes(origin) ||
      env.TRUSTED_ORIGINS.includes(origin) ||
      isLocalhostOrigin(origin)
    ) {
      return origin;
    }
    return null;
  },
  credentials: true,
  allowMethods: ['POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
});

export const feedsRoutes = new Hono<AuthedEnv>()
  // Public single-feed subscribe. CORS for extension origins, then auth,
  // then handler. Mounted under /api/feeds so the path is `POST /api/feeds`.
  .post(
    '/',
    publicCors,
    requireAuthMiddleware,
    zValidator('json', z.object({ url: feedUrlSchema })),
    async (c) => {
      const user = c.var.user;
      const { url } = c.req.valid('json');
      const [feed] = await withTransaction(db, user.id, user.plan, async (ctx) => {
        const created = await createFeeds(ctx, [{ feedUrl: url }]);
        // Touch txid so the transaction is materialized before returning.
        await getTxId(ctx.conn);
        return created;
      });
      return c.json(feed, 201);
    },
  )
  // Internal routes — same-origin only, no extra CORS needed.
  .use('*', requireAuthMiddleware)
  // Collection.onInsert (batch + txid handshake)
  .post('/create', zValidator('json', z.array(CreateFeedSchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await createFeeds(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .patch('/update', zValidator('json', z.array(UpdateFeedSchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await updateFeeds(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/delete', zValidator('json', z.array(z.uuidv7())), async (c) => {
    const user = c.var.user;
    const ids = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await deleteFeeds(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .post('/discover', zValidator('json', z.object({ url: feedUrlSchema })), async (c) => {
    const { url } = c.req.valid('json');
    const result = await discoverRssFeeds(url);
    return c.json(result);
  })
  .post('/import-opml', zValidator('json', z.object({ opmlContent: z.string() })), async (c) => {
    const user = c.var.user;
    const { opmlContent } = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, (ctx) =>
      importOpmlFeeds(ctx, opmlContent),
    );
    return c.json(result);
  })
  .get('/export-opml', async (c) => {
    const user = c.var.user;
    const opml = await exportOpmlFeeds(user.id);
    return c.json(opml);
  })
  .get('/has-any', async (c) => {
    const user = c.var.user;
    const feed = await db.query.feeds.findFirst({
      columns: { id: true },
      where: eq(feeds.userId, user.id),
    });
    return c.json({ hasAny: feed !== undefined });
  })
  .post('/retry', zValidator('json', z.object({ id: z.uuidv7() })), async (c) => {
    const user = c.var.user;
    const { id } = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await retryFeed(ctx, id);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  })
  .get('/sync-logs', zValidator('query', z.object({ feedId: z.uuidv7() })), async (c) => {
    const user = c.var.user;
    const { feedId } = c.req.valid('query');
    const logs = await getFeedSyncLogs(user.id, feedId, 200);
    return c.json(logs);
  })
  .post('/follow-with-tags', zValidator('json', FollowFeedsWithTagsSchema), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await followFeedsWithTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  });
