# API Application - Bun + Hono

Standalone HTTP API. Owns all server-side concerns: auth, Electric SQL shape proxies, entity mutations, OAuth, MCP, well-known endpoints. End-to-end typed to `apps/web/` via Hono's `hc` client (`@repo/api/client`).

## 🚧 Migration Context

This app is the target home for **everything that currently lives in `apps/web/src/server/`, `apps/web/src/routes/api/`, and `*.functions.ts`**. Both stacks run side-by-side until the migration finishes.

Read `docs/records/011-migrate-server-off-tanstack-start.md` for the full plan and the per-step order. Routes currently live under `/api2/*` (intentionally ugly) so they can't be confused for the long-term path — they get renamed to `/api/*` once TanStack Start is removed from web.

**Do not reintroduce Elysia.** An earlier attempt used Elysia + Eden Treaty and was abandoned after the recursive `App` type crashed TypeScript and degraded to `{}` under tsgolint, with no working combination of versions or compiler flags. See "Pivot to Hono" in record 011 for the postmortem and the open upstream issues.

## Commands

```bash
bun dev    # Hot-reload dev server
bun start  # Production
```

Run `bun checks` from the repo root after every change.

## Directory Structure

```
src/
  index.ts        # Hono app entrypoint: CORS, error mapping, request logging, route mounts
  env.ts          # t3-env validation
  client.ts       # Type-only re-export for hc<App> (consumed by web via @repo/api/client)
  middleware/
    auth.ts       # Auth middleware + requireUser (the pattern for every protected route)
  routes/
    shapes.ts     # Electric SQL shape proxies
    feeds.ts      # Template for mutation endpoints (auth → validate → withTransaction → error map)
    chat.ts       # ⚠️ stripped-down AI streaming stub — not the real endpoint yet
```

## Core Patterns

- **Chain `.get/.post/...` calls on the same app reference** so Hono's RPC inference (`typeof app`) sees every route. Splitting routes across reassigned variables loses types.
- **Auth** — every protected route uses the auth middleware + `requireUser` pattern from `src/middleware/auth.ts`. Do not roll your own session reads.
- **Domain calls** — route handlers should be thin: validate input → call `@repo/domain` inside `withTransaction` → map errors. No business logic in handlers.
- **Errors** — domain errors are transport-agnostic; the central `app.onError` in `src/index.ts` maps them to HTTP. See `docs/error-handling.md`.
- **Validation** — Zod via `@hono/zod-validator` (`zValidator('json', schema)`), since domain schemas are Zod.

## Typed RPC client (`hc`)

`src/client.ts` exports `type App = typeof app` only — never values. Web imports it via `@repo/api/client` and builds the `hc<App>(...)` client in `apps/web/src/lib/api-client.ts`. End-to-end types flow without codegen.

Call shape on the client: `client.api2.feeds.discover.$post({ json: { url } })` returns a typed `Response`. The `unwrap()` helper in `apps/web/src/lib/api-client.ts` checks `res.ok` and parses JSON.

## Auth

Shared Better Auth config lives in `@repo/auth` via a `createAuth(options)` factory. This api app calls the factory **without** `tanstackStartCookies()` (web does the opposite). A session cookie issued by either app is accepted by both, because they share `BETTER_AUTH_SECRET` and the same DB.

## Notes

- Path mapping: none yet; use relative imports inside `src/`, `@repo/*` for workspace packages
- TypeScript strict mode
- No `.server.ts` suffix — folder = layer here, suffix has no meaning
