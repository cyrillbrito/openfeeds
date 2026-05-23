# API Application - Bun + Hono

Standalone HTTP API. Owns all server-side concerns: auth, Electric SQL shape proxies, entity mutations, OAuth, MCP, well-known endpoints. End-to-end typed to `apps/web/` via Hono's `hc` client (`@repo/api/client`).

## Commands

```bash
bun dev    # Hot-reload dev server (port 3401)
bun start  # Production
```

Run `bun checks` from the repo root after every change.

## Directory Structure

```
src/
  index.ts        # Hono app entrypoint: CORS, error mapping, route mounts
  env.ts          # t3-env validation
  auth.ts         # Re-export of the shared @repo/auth instance
  client.ts       # Type-only re-export for hc<App> (consumed by web via @repo/api/client)
  middleware/
    auth.ts       # authMiddleware (nullable) + requireAuthMiddleware (asserts, narrows types)
  routes/
    shapes.ts     # Electric SQL shape proxies (per-table, scoped to user_id)
    feeds.ts      # Entity routes + the one public-API endpoint (see below)
    well-known.ts # OAuth/OIDC discovery (mounted at /.well-known/*)
    mcp.ts        # MCP Streamable HTTP transport
    chat.ts       # AI chat over Server-Sent Events
    public-config.ts # Browser-safe runtime config (social provider availability)
    ...           # One file per entity
```

## Core Patterns

- **Chain `.get/.post/...` calls on the same app reference** so Hono's RPC inference (`typeof app`) sees every route. Splitting routes across reassigned variables loses types.
- **Auth** — every protected route uses `requireAuthMiddleware` from `src/middleware/auth.ts`. Mount with `new Hono<AuthedEnv>().use('*', requireAuthMiddleware)`. The middleware throws 401 if there's no session, so handlers get `c.var.user` and `c.var.session` typed non-null — no per-handler `requireUser` calls. Use `authMiddleware` + `Env` only on routers that genuinely mix public and protected handlers (current example: `article-audio.ts`'s `/available`). Do not roll your own session reads.
- **Domain calls** — route handlers should be thin: validate input → call `@repo/domain` inside `withTransaction` → map errors. No business logic in handlers.
- **Errors** — domain errors are transport-agnostic; the central `app.onError` in `src/index.ts` maps them to HTTP. See `docs/error-handling.md`.
- **Validation** — Zod via `@hono/zod-validator` (`zValidator('json', schema)`), since domain schemas are Zod.
- **Mutation handshake** — internal entity routes take **batched** input and return `{ txid }` so the web client's TanStack DB collection can resolve the optimistic transaction once Electric replays it.

## Public-API endpoints

Most routes are "internal" — same-origin only, batched + txid handshake. A few endpoints are public-shaped (single object in, row out) and meant for non-web consumers: the browser extension, curl, third-party scripts. The current example is `POST /api/feeds` in `routes/feeds.ts`.

Pattern:

- Live on the relevant entity router (no separate "external" sub-app — there is no such namespace).
- Carry their own `cors()` middleware that widens the global TRUSTED_ORIGINS policy to also allow `chrome-extension://`, `moz-extension://`, and localhost in dev.
- Declared as the **root method** (`.post('/', cors, requireAuthMiddleware, validator, handler)`) so the URL is the entity's natural noun, e.g. `POST /api/feeds`.

Watch out: combining a root-method (`.post('/')`) with sibling subpaths (`.post('/create')`) on the same router can collapse Hono RPC type inference for the entire router. Run `bun checks` after adding one and verify the web client's `api.api.<entity>.<...>` calls still type-check. If inference breaks, move the public route to the top-level `app` in `src/index.ts` instead.

## Typed RPC client (`hc`)

`src/client.ts` exports `type App = typeof app` only — never values. Web imports it via `@repo/api/client` and builds the `hc<App>(...)` client in `apps/web/src/lib/api-client.ts`. End-to-end types flow without codegen.

Call shape on the client: `client.api.feeds.discover.$post({ json: { url } })` returns a typed `Response`. The `unwrap()` helper in `apps/web/src/lib/api-client.ts` checks `res.ok` and parses JSON.

## Auth

`@repo/auth` exports a configured Better Auth instance directly (no factory — there's only one consumer). This app re-exports it from `src/auth.ts` and mounts `auth.handler` as a Hono catch-all (`.all('/api/auth/*', …)`), which passes Set-Cookie through natively.

## Notes

- Path mapping: `~/*` → `./src/*` (Bun resolves via tsconfig paths)
- TypeScript strict mode
- No `.server.ts` suffix — folder = layer here, suffix has no meaning
