# Hono Routes Pattern

Entity routes live in `apps/server/src/routes/<entity>.ts` as Hono routers. They're the bridge between client collections and domain logic.

## Standard Mutation Pattern

```typescript
import { zValidator } from '@hono/zod-validator';
import { db, getTxId } from '@repo/db';
import {
  createFeeds,
  CreateFeedSchema,
  withTransaction,
} from '@repo/domain';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

export const feedsRoutes = new Hono<AuthedEnv>()
  .use('*', requireAuthMiddleware)
  .post('/create', zValidator('json', z.array(CreateFeedSchema)), async (c) => {
    const user = c.var.user;
    const data = c.req.valid('json');
    const result = await withTransaction(db, user.id, user.plan, async (ctx) => {
      await createFeeds(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
    return c.json(result);
  });
```

Mount with `.route('/api/feeds', feedsRoutes)` on the main `app` in `apps/server/src/index.ts`.

## Key Rules

1. **Always use `requireAuthMiddleware`** on protected routes — handlers get `c.var.user` and `c.var.session` typed non-null. No per-handler `requireUser` calls.
2. **Mutations return `{ txid }`** — the transaction ID is used by TanStack DB for optimistic sync confirmation.
3. **`withTransaction` owns the boundary** — domain functions never create their own top-level transactions.
4. **Use `zValidator('json', schema)`** for body validation — domain schemas are already Zod.
5. **Chain calls on a single `app` reference** so Hono RPC type inference (`typeof app`) sees every route. Splitting routes across reassigned variables loses types.

## Public-API Routes (Cross-Origin)

Most routes are internal (same-origin, batched, txid handshake). A few are public-shaped for non-web consumers (browser extension, third-party scripts) — single object in, row out:

- Live on the same entity router (no separate "external" sub-app).
- Carry their own `cors()` middleware that widens TRUSTED_ORIGINS to allow the extension's specific `chrome-extension://<id>` / `moz-extension://<id>` from `EXTENSION_ORIGINS`.
- Declared as the root method: `.post('/', cors, requireAuthMiddleware, validator, handler)` so the URL is the entity's natural noun, e.g. `POST /api/feeds`.
- Still session-authed (Better Auth cookie required) — there is no API-key model.

Current example: `POST /api/feeds` in `apps/server/src/routes/feeds.ts`.

**Watch out:** combining a root-method (`.post('/')`) with sibling subpaths (`.post('/create')`) on the same router can collapse Hono RPC type inference for the entire router. Run `bun checks` after adding one and verify the web client's `api.api.<entity>.<...>` calls still type-check. If inference breaks, move the public route to the top-level `app` in `src/index.ts` instead.

## Typed RPC on the Client

`apps/server/src/client.ts` exports `type App = typeof app` only — never values. The web app imports it via `@repo/server/client` and builds `hc<App>(window.location.origin)` in `apps/web/src/lib/api-client.ts`. End-to-end types flow without codegen.

Call shape in collection handlers:

```typescript
return await unwrap(api.api.feeds.create.$post({ json: feeds }));
```

`unwrap()` checks `res.ok` and parses JSON, throwing `new Error(body.message)` on non-2xx. Every Hono route returns errors as `{ message }` via the central `app.onError`.

## Module Layout

- `apps/server/src/routes/<entity>.ts` — Hono router for that entity (one file per entity).
- `apps/server/src/index.ts` — mounts every router with `.route('/api/<entity>', ...)`.
- `apps/server/src/middleware/auth.ts` — `requireAuthMiddleware` (asserts session, narrows types) and `authMiddleware` (nullable, for mixed public/protected routers).
