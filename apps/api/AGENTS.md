# API Application - Bun + Elysia

Standalone HTTP API. Owns all server-side concerns: auth, Electric SQL shape proxies, entity mutations, OAuth, MCP, well-known endpoints. End-to-end typed to `apps/web/` via Eden Treaty (`@repo/api/client`).

## 🚧 Migration Context

This app is the target home for **everything that currently lives in `apps/web/src/server/`, `apps/web/src/routes/api/`, and `*.functions.ts`**. Both stacks run side-by-side until the migration finishes.

Read `docs/records/011-migrate-server-to-elysia.md` for the full plan, the prototype write-up, and the per-step order. Routes currently live under `/api2/*` (intentionally ugly) so they can't be confused for the long-term path — they get renamed to `/api/*` once TanStack Start is removed from web.

**Load the `elysiajs` skill** (at `.agents/skills/elysiajs/`) when working in here.

## Commands

```bash
bun dev    # Hot-reload dev server
bun start  # Production
```

Run `bun checks` from the repo root after every change.

## Directory Structure

```
src/
  index.ts        # Elysia entrypoint: CORS, error mapping, request logging, route mounts
  env.ts          # t3-env validation
  client.ts       # Type-only re-export for Eden Treaty (consumed by web via @repo/api/client)
  auth.ts         # ⚠️ legacy duplicate Better Auth instance — being deleted (step 1 of record 011)
  middleware/
    auth.ts       # authPlugin + requireUser (the pattern for every protected route)
  routes/
    shapes.ts     # Electric SQL shape proxies
    feeds.ts      # Template for mutation endpoints (auth → validate → withTransaction → error map)
    chat.ts       # ⚠️ stripped-down AI streaming stub — not the real endpoint yet
```

## Core Patterns

- **Method chaining is required** for Elysia type safety. Never split a chain into reassigned variables — the type inference breaks. The `elysiajs` skill covers this.
- **Auth** — every protected route uses the `authPlugin` + `requireUser` pattern from `src/middleware/auth.ts`. Do not roll your own session reads.
- **Domain calls** — route handlers should be thin: validate input → call `@repo/domain` inside `withTransaction` → map errors. No business logic in handlers.
- **Errors** — domain errors are transport-agnostic; the central `onError` in `src/index.ts` maps them to HTTP. See `docs/error-handling.md`.
- **Validation** — TypeBox (`Elysia.t`) is the default. Zod is allowed where domain schemas already use it.

## Eden Treaty

`src/client.ts` exports `type App = typeof app` only — never values. Web imports it via `@repo/api/client` and builds the `treaty<App>(...)` client in `apps/web/src/lib/api-client.ts`. End-to-end types flow without codegen.

If `tsc --noEmit` crashes on Eden's recursive `App` type, that's the known TS6 beta issue (see record 011, "Open questions"). `bun checks` (oxlint + tsgolint) passes regardless.

## Auth

Shared Better Auth config lives in `@repo/auth` via a `createAuth(options)` factory. This api app calls the factory **without** `tanstackStartCookies()` (web does the opposite). A session cookie issued by either app is accepted by both, because they share `BETTER_AUTH_SECRET` and the same DB.

The legacy `src/auth.ts` in this folder is scheduled for deletion — see step 1 of record 011.

## Notes

- Path mapping: none yet; use relative imports inside `src/`, `@repo/*` for workspace packages
- TypeScript strict mode
- No `.server.ts` suffix — folder = layer here, suffix has no meaning
