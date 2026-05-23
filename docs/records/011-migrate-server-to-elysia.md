---
date: 2026-05-19
status: planned
---

# Migrate server layer off TanStack Start to Bun + Elysia

## Why

TanStack Start + Nitro + Vite has been a persistent source of pain that is not getting better:

- **Dev/prod parity broken** — Nitro bundles differently than Vite serves. Things that work locally fail in production with opaque CJS/ESM interop errors (see `docs/nitro-bundling.md`).
- **Opaque runtime errors** — popups with no actionable detail. Hard to tell whether the failure is Vite HMR, Nitro, Start's router, or our code.
- **`.server.ts` + dynamic import tax** — every shared util becomes a "is this frontend or backend?" question. Top-level static imports of `*.server.*` files survive tree-shaking and trip the import-protection plugin, forcing `await import()` inside server callbacks (`apps/web/AGENTS.md` documents this).
- **Ecosystem churn** — TanStack Start is pre-1.0, Nitro is mid-rewrite (v3 / h3 v2), Vite 6/7 transitions. We sit on the bleeding edge of three things at once.
- **Architectural mismatch** — OpenFeeds is local-first with Electric SQL. The page shell loads, then the client hydrates from the local DB. We pay the full SSR-framework complexity cost while getting almost none of its benefit (no SEO needs, no auth-gated data loaders, no streaming SSR).

Going to Bun + Elysia + Eden Treaty means:

- One bundler for frontend (Vite, SPA mode), one runtime for backend (Bun + Elysia). Both are boring and stable.
- Dev = prod. No Nitro bundling surprises.
- Folder = layer. No `*.server.ts` confusion.
- End-to-end types via Eden Treaty (no codegen, no schema duplication).
- Bun is already what we run in production, so no new operational risk.

A side-by-side prototype proved viability and is being kept as the starting point of the real migration — see the prototype section below for what stays and what gets replaced.

## Prototype results

`apps/api/` was built side-by-side with `apps/web/` to validate the approach without touching production paths. Routes live under `/api2/*` (the `/api` namespace is owned by Nitro). One Electric shape proxy, one mutation endpoint, and the AI chat streaming endpoint were ported.

Findings:

- **Electric SQL proxy** works unchanged. Same `fetch` forwarding pattern, same auth scoping, same headers. The 80-line proxy function copies cleanly into an Elysia handler.
- **Domain layer** (`@repo/domain` + `withTransaction` + error classes) carries over with zero changes. Elysia handlers call domain functions exactly like Start handlers did.
- **AI streaming** with `@tanstack/ai` works untouched. `toServerSentEventsResponse()` returns a plain `Response`, which Elysia returns directly. Tokens flow.
- **Better Auth** runs cleanly in Elysia. Same DB and `BETTER_AUTH_SECRET` between the two apps means a session issued by either is accepted by both. In the final state only Elysia will own auth.
- **Eden Treaty** end-to-end types work. The full request/response shape (including error variants) is inferred at the call site from `type App = typeof app`.
- **Same-origin in dev over Tailscale** required a small workaround. Nitro claims the entire HTTP layer of the Vite dev server — `server.proxy` in `vite.config.ts` never runs. Solution: a single Start catch-all at `apps/web/src/routes/api2/$.ts` that forwards everything under `/api2` to the Elysia server. This goes away once Start is removed.

One unresolved concern: `tsc --noEmit` (TypeScript 6 beta) crashes on Eden's deeply recursive `App` type. `bun checks` (oxlint + tsgolint) passes cleanly. Real fix is waiting for TS6 stable or pinning a TS5 for type-checking. Not a blocker.

## What the prototype leaves behind

The prototype is not thrown away. Most of it is the real migration. Status per file:

Keep as-is and build on:

- `apps/api/package.json`, `tsconfig.json`, `src/env.ts` — boilerplate, correct shape.
- `apps/api/src/index.ts` — entrypoint with CORS, error mapping, request logging. The `onRequest` + `onParse` logging is useful during migration but should be gated on `NODE_ENV === 'development'` or removed before the first production deploy. The CORS plugin is currently unused because everything flows through the Start forwarder; leave it for when the browser extension calls the api cross-origin (or delete it for now).
- `apps/api/src/middleware/auth.ts` — `authPlugin` + `requireUser` are the pattern for every protected route.
- `apps/api/src/routes/shapes.ts` — Electric proxy ported faithfully. Add more shape entries here in step 2.
- `apps/api/src/routes/feeds.ts` — template for mutation endpoints (auth → validate → withTransaction → error mapping).
- `apps/api/src/client.ts` — type-only re-export for Eden Treaty.
- `apps/web/src/lib/api-client.ts` — Eden client wiring.
- `apps/web/src/routes/api2/$.ts` — Start-side forwarder that lets the browser hit `/api2/*` same-origin. Ugly but necessary, deleted at step 8.

Throw away or replace:

- `apps/api/src/auth.ts` — duplicate Better Auth instance. The whole reason step 1 of the plan exists is to delete this file. Do not add features to it. Once `@repo/auth` is extracted, this becomes `import { auth } from '@repo/auth'` and the file disappears.
- `apps/api/src/routes/chat.ts` — stripped-down stub. No tools, no persistence middleware, no analytics, no system prompt builder, no context injection. Proves streaming works but is not the real endpoint. The real `/api/chat` migration needs all of that, which itself depends on first moving the `ai-*.server.ts` files to `@repo/domain/ai` (see "Things worth extracting" below).

Other prototype-specific things to note:

- All migrated routes currently live under `/api2/*` as an intentional ugly placeholder so it cannot be confused for the long-term path. Renamed to `/api/*` at step 8.
- Two `betterAuth()` instances are running side-by-side, sharing DB and `BETTER_AUTH_SECRET`. This works but is brittle (config drift between them would cause subtle bugs). Step 1 collapses them into one.

## High-level plan

The migration is mostly mechanical. Most server functions are 5 to 20 line wrappers over `@repo/domain` calls. The hard parts (`@repo/domain` itself, Electric SQL, the AI engine) are already framework-agnostic packages.

The plan, in rough order:

1. **Extract `@repo/auth` first.** [DONE] Better Auth configuration, plugin setup, and the `getSession` helper moved into a dedicated package (`packages/auth/`). Both `apps/web/` and `apps/api/` consume it via a `createAuth(options)` factory (a top-level shared instance was not viable: web must inject `tanstackStartCookies()` as its last plugin so `auth.api.signInEmail`-style server calls work through Start's response builder; api must not). The factory keeps a single source of truth for the actual config — adapters, plugins, hooks, social providers, OAuth provider — so a session cookie issued by either app is accepted by both. The env-free schema mirror moved alongside it as `packages/auth/src/schema-config.ts` and `packages/db`'s `generate:auth-schema` script was repointed. When TanStack Start is removed (step 8), the factory call in api becomes a plain `auth` re-export and the web bootstrap file disappears entirely.

   Note on naming: the new files in `packages/auth/` and the web bootstrap (`apps/web/src/server/auth.ts`) intentionally drop the `.server.ts` suffix. That suffix exists only to opt into TanStack Start's import-protection plugin, which is irrelevant inside a workspace package and unnecessary in `apps/web/server/` files whose imports (`@repo/auth`, `@repo/db`, `@repo/domain`) are already blocked from client code by specifier patterns. Once Start is gone the suffix has no remaining meaning anywhere; new code should not use it.

2. **Migrate every shape proxy route.** Eight files in `apps/web/src/routes/api/shapes/` — all identical pattern with a different table name. Pure copy-paste into `apps/api/src/routes/shapes.ts`. Each migrated path moves from `/api/shapes/X` to `/api2/shapes/X` until the final rename in step 8.

3. **Migrate every entity server function.** Ten `*.functions.ts` files in `apps/web/src/entities/`, around 30 `createServerFn` exports total. The list (with current line counts as a rough difficulty proxy): actions (11), article-audio (71), article-tags (32), articles (33), chat-sessions (17), feed-tags (32), feeds (99), filter-rules (36), settings (44), tags (36). Each becomes an Elysia route. Call sites in collection definitions swap from `$$createFeeds({ data })` to `api.api2.feeds.index.post({ ... })` via Eden Treaty. The contract stays the same — these are still client-server boundaries — but typing is now structural rather than RPC-stub-based.

4. **Migrate external API routes.** `apps/web/src/routes/api/feeds.ts` (used by the browser extension) and `apps/web/src/routes/api/articles/$articleId/audio.ts`. Same pattern as entity functions but with explicit CORS for chrome-extension origins.

5. **Migrate well-known + MCP.** `apps/web/src/server/well-known.server.ts` and `apps/web/src/routes/api/mcp/$.ts` move into Elysia. MCP is already SSE-pattern and that's been proven to work.

6. **Move Better Auth ownership to Elysia.** With `@repo/auth` extracted, Elysia becomes the authoritative `/api/auth/*` handler. Web's current `/api/auth/$.ts` becomes a forwarder (same as the `/api2/$.ts` proxy added during the prototype) until step 8. Session cookies don't change.

7. **Migrate OAuth provider + consent flow.** The `oauthProvider` plugin lives inside the `betterAuth()` config, so it moves with `@repo/auth` automatically. The only manual work: the consent page (`apps/web/src/routes/oauth/consent.tsx`) stays as a SolidJS UI in web; the discovery URLs in `.well-known/oauth-authorization-server` must point at the api origin once it owns auth; MCP audience config needs updating. External OAuth clients (Claude desktop, etc.) only care about discovery URLs, which stay at `BASE_URL` — zero client-facing change.

8. **Delete everything.** `apps/web/src/server/*`, `apps/web/src/routes/api/`, the `routes/api2/$.ts` forwarder, the Nitro plugin from `vite.config.ts`. Rename `/api2/*` back to `/api/*` on Elysia. Drop `nitro` and `@tanstack/solid-start` from web's dependencies. Web becomes a pure Vite SPA.

## Things worth extracting along the way

Beyond `@repo/auth`, two things are good candidates for packages:

- **`packages/electric-proxy/`** — the proxy function is reused by every shape endpoint. Currently a single file in web. Pulling it out makes the dependency direction explicit and lets `apps/api/` import it cleanly.
- **AI middleware/tools** — `ai-tools.server.ts`, `ai-persistence.server.ts`, `ai-system-prompt.server.ts`, `ai-analytics.server.ts` are domain logic disguised as server files. They belong in `@repo/domain/ai` (or a new `@repo/ai`). Once moved, `apps/api/` just calls them.

After these extractions, `apps/api/` is mostly routing glue — auth mount, electric proxy mount, route → domain call → response. Which is what an API app should be.

## Order rationale and risk

Step 1 (auth package) is done first because it's a small mechanical change that removes a real smell (two auth instances) and unblocks every later step that touches auth. It is otherwise behaviour-neutral.

Auth migration itself (step 6) is deferred because the auth flow is barely used in production today. The endpoints exist but few users hit them. Migrating it later means most of the risky surface (OAuth, MCP, consent flow) gets touched after the simpler patterns have been validated by repeated use. By that point the migration is almost a configuration move.

Steps 2 to 4 are the bulk of the work but each individual migration is cheap and isolated — one entity function or one shape route at a time, with the call site updated in the same change. Easy to interleave with regular feature work, easy to revert per-endpoint.

Step 8 (delete Start) only happens once everything else is verified working in production. The `/api2` prefix is intentionally ugly so it cannot be confused for the long-term path.

## Open questions

- TS6 + Eden deep instantiation crash — confirm it goes away with TS6 stable, or pin TS5 for type-checking until it does.
- Deploy story for `apps/api/` — single Bun process? Separate service? Reverse proxy in front of both? Probably matches whatever we already do for `apps/worker/`.
- Whether the browser extension keeps calling `/api/feeds` cross-origin (CORS) or gets pointed at the api origin directly. Either works.

## Non-goals

- Rewriting any business logic. `@repo/domain` is the source of truth and does not change.
- Replacing TanStack Solid Router. SPA mode works; we keep it.
- Replacing TanStack Solid DB / Electric SQL. The whole point of this migration is that the local-first stack is healthy — it's the SSR framework that isn't.
