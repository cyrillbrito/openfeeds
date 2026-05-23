# Hono + `hc` RPC in OpenFeeds

Project-specific patterns and gotchas for the api app (`apps/api/`) and its typed client consumed by `apps/web/`. The generic Hono skill (`.agents/skills/hono/SKILL.md`) covers the framework itself — this doc only captures what's specific to this codebase.

Background: see `docs/records/011-migrate-server-off-tanstack-start.md` for why we chose Hono (after abandoning Elysia + Eden Treaty) and what the end-state architecture looks like.

## `noUncheckedIndexedAccess` is incompatible with Hono RPC

Hono's `ClientResponse` is a status-keyed discriminated union (`ClientResponse<Body, Status, Format>`). With `noUncheckedIndexedAccess: true`, the union collapses to `any` at the call site.

**Do not turn it on in any tsconfig that consumes `hc<App>` types** — currently `apps/web/tsconfig.json`. This is the milder counterpart to the Eden/Elysia issue that killed our Elysia attempt: Hono fails gracefully (everything becomes `any`) instead of crashing `tsc`, which makes it more dangerous because it looks like it works.

## Root-method routes + sibling subpaths can collapse RPC inference

This works most of the time but can silently break:

```ts
const entityRoutes = new Hono()
  .post('/', cors, authMw, validator, handler)   // public-API endpoint
  .post('/create', authMw, validator, handler)   // internal batched mutation
  .patch('/update', authMw, validator, handler)
```

If the root-method handler's request/response shape differs sharply from the sibling subpaths', Hono's RPC type for the entire router can collapse. Run `bun checks` immediately after adding a `.<method>('/')` route and verify `client.api.<entity>.<...>` still has narrow types at call sites in `apps/web/`. If inference broke, move the root route to the top-level `app` in `apps/api/src/index.ts` instead of the sub-router.

Currently in use for `POST /api/feeds` in `apps/api/src/routes/feeds.ts` (extension-facing endpoint) — survived inference, but treat any future addition with the same skepticism.

## Hyphenated mount paths require bracket access — and can collapse types

```ts
// Server (apps/api/src/index.ts)
app.route('/api/public-config', publicConfigRoutes)

// Client (apps/web/)
client.api['public-config'].config.$get({})  // works
client.api.public-config.config.$get({})     // syntax error
```

`Awaited<ReturnType<typeof client.api['public-config'].config.$get>>` through a hyphenated bracket access can collapse to `any`. Workaround: type the unwrapped value inline instead of going through `Awaited<ReturnType<typeof ...>>`.

## Public endpoints: scoped CORS on the entity router

For endpoints that must accept cross-origin requests (browser extension, third-party scripts), don't create a separate "external" sub-app. Put the route on the relevant entity router with its own `cors()` middleware widening the policy:

```ts
import { cors } from 'hono/cors'

const publicCors = cors({
  origin: (origin) => {
    if (!origin) return null
    if (origin.startsWith('chrome-extension://')) return origin
    if (origin.startsWith('moz-extension://')) return origin
    if (TRUSTED_ORIGINS.includes(origin)) return origin
    return null
  },
  credentials: true,
})

feedsRoutes.post('/', publicCors, authMiddleware, zValidator('json', schema), handler)
```

Route-scoped CORS keeps the wider policy attached to the route that needs it; the rest of the app stays on the strict global policy (TRUSTED_ORIGINS only).

## `unwrap()` helper for non-streaming `hc` calls

`hc` returns a raw `Response`. We standardize on this helper in `apps/web/src/lib/api-client.ts`:

```ts
import type { ClientResponse } from 'hono/client';

type SuccessBody<R> = R extends ClientResponse<infer B, infer S, infer _F>
  ? S extends 200 | 201 | 202 | 204
    ? B
    : never
  : never;

export async function unwrap<R extends ClientResponse<any, any, any>>(
  res: R | Promise<R>,
): Promise<SuccessBody<R>> {
  const r = await res;
  if (!r.ok) {
    const { message } = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(message ?? `Request failed: ${r.status}`);
  }
  return r.json() as Promise<SuccessBody<R>>;
}
```

`Extract`-by-2xx-status is required because `ClientResponse` is a status-keyed union — a naive `await res.json()` returns the union of *all* possible bodies including error shapes.

Use `unwrap()` for everything except streaming endpoints (SSE chat, audio). For streams, work with the `Response` directly.

## Central `app.onError` keeps handlers thin

All domain errors map to `{ message: string }` JSON in one place (`apps/api/src/index.ts`):

```ts
app.onError((err, c) => {
  if (err instanceof AuthError) return c.json({ message: err.message }, 401);
  if (err instanceof ValidationError) return c.json({ message: err.message }, 400);
  if (err instanceof DomainError) return c.json({ message: err.message }, 400);
  // ... etc, then a final 500 fallthrough
  return c.json({ message: 'Internal server error' }, 500);
});
```

Handlers `throw` domain errors directly; never `try/catch` inside a handler to construct an HTTP response. `unwrap()` on the client reads `{ message }` to surface the error to users.

See `docs/error-handling.md` for the full domain-error → HTTP mapping.

## Better Auth: catch-all mount

Mount Better Auth as a catch-all to preserve `Set-Cookie` and Better Auth's own routing:

```ts
import { auth } from '@repo/auth';

app.all('/api/auth/*', (c) => auth.handler(c.req.raw));
```

Don't try to route individual Better Auth paths through Hono validators — Better Auth owns the entire `/api/auth/*` namespace and Hono should pass requests through untouched.

## Mutation handshake pattern (internal entity routes)

Routes consumed by TanStack DB collections take a **batched array** input and return `{ txid }` so the client can resolve its optimistic transaction once Electric replays the change:

```ts
.post(
  '/create',
  authMiddleware,
  zValidator('json', z.array(insertSchema)),
  async (c) => {
    const user = c.var.user;
    const items = c.req.valid('json');
    const txid = await withTransaction(async (ctx) => {
      for (const item of items) await createEntity(ctx, user, item);
      return ctx.txid;
    });
    return c.json({ txid });
  },
)
```

Deletes use the same pattern but with a `POST /delete` route accepting `z.array(z.uuidv7())`. HTTP `DELETE` with a JSON body works but is awkward through fetch and proxies; `POST /delete` is consistent and unambiguous.

See `docs/data-layer.md` for the client side of this handshake.

## `.well-known/*` at the host root

RFC 8615 says well-known URIs must live at the host root, not under `/api`. The api app mounts `wellKnownRoutes` at `/.well-known/*` directly (`apps/api/src/index.ts`); the Vite dev proxy in `apps/web/vite.config.ts` forwards `/.well-known/*` alongside `/api/*` so the dev origin behaves like prod.

## Client construction

`apps/api/src/client.ts` exports `type App = typeof app` only — never values. Web imports it via `@repo/api/client` and builds the `hc<App>(...)` client in `apps/web/src/lib/api-client.ts`. End-to-end types flow without codegen.
