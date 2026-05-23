---
date: 2026-05-19
updated: 2026-05-23
status: in-progress (framework changed mid-migration — see "Pivot to Hono" below)
---

# Migrate server layer off TanStack Start to a standalone Bun API

Originally titled "Migrate server layer off TanStack Start to Bun + Elysia". Elysia was tried and abandoned — see "Pivot to Hono" at the bottom. The motivation, target architecture, and step plan are unchanged; only the framework choice flipped.

## Why

TanStack Start + Nitro + Vite has been a persistent source of pain that is not getting better:

- **Dev/prod parity broken** — Nitro bundles differently than Vite serves. Things that work locally fail in production with opaque CJS/ESM interop errors (see `docs/nitro-bundling.md`).
- **Opaque runtime errors** — popups with no actionable detail. Hard to tell whether the failure is Vite HMR, Nitro, Start's router, or our code.
- **`.server.ts` + dynamic import tax** — every shared util becomes a "is this frontend or backend?" question. Top-level static imports of `*.server.*` files survive tree-shaking and trip the import-protection plugin, forcing `await import()` inside server callbacks (`apps/web/AGENTS.md` documents this).
- **Ecosystem churn** — TanStack Start is pre-1.0, Nitro is mid-rewrite (v3 / h3 v2), Vite 6/7 transitions. We sit on the bleeding edge of three things at once.
- **Architectural mismatch** — OpenFeeds is local-first with Electric SQL. The page shell loads, then the client hydrates from the local DB. We pay the full SSR-framework complexity cost while getting almost none of its benefit (no SEO needs, no auth-gated data loaders, no streaming SSR).

Splitting into a Vite SPA + standalone Bun HTTP API means:

- One bundler for frontend (Vite, SPA mode), one runtime for backend (Bun). Both are boring and stable.
- Dev = prod. No Nitro bundling surprises.
- Folder = layer. No `*.server.ts` confusion.
- End-to-end types via the API framework's typed RPC client (no codegen, no schema duplication).
- Bun is already what we run in production, so no new operational risk.

## Pivot to Hono

**The first attempt used Elysia + Eden Treaty. It was abandoned after the type system proved unusable in our setup.**

What went wrong:

- `tsc --noEmit` crashes with a `Debug Failure` deep in `getSignatureApplicabilityError` when checking Eden's recursive `App` type. Reproduced on both TypeScript 6.x and 5.9.3.
- `oxlint-tsgolint` (what `bun checks` actually uses — independent of installed `tsc`) doesn't crash but silently degrades every Eden response type to `{}`, producing 30+ TS2339/TS2345 errors at call sites in `apps/web/`.
- Confirmed upstream: Elysia [#1817](https://github.com/elysiajs/elysia/issues/1817) (Eden Treaty responses break with `noUncheckedIndexedAccess` — open), [#1761](https://github.com/elysiajs/elysia/issues/1761) (eden response always any — open), [#1725](https://github.com/elysiajs/elysia/issues/1725) (factory sub-apps cause response type intersection — open), [#1855](https://github.com/elysiajs/elysia/issues/1855) (TS6 compatibility issues — open), [#1031](https://github.com/elysiajs/elysia/issues/1031) (poor tsserver performance — open).

Things tried, none of which fixed it:

- Pinning `elysia` to 1.4.27 (1.4.28 makes the issue strictly worse per #1817 — symptoms reduced but not eliminated at 1.4.27).
- Disabling `noUncheckedIndexedAccess` in `apps/web/tsconfig.json`.
- Local TypeScript pin to 5.9.3 in `apps/api/` and `apps/web/`.

The recursive `App` type Elysia builds in our shape (~11 routers, plugin chain, mixed Zod + TypeBox, Better Auth mount, cors plugin) blows past what TypeScript can handle. The bugs are open, the workarounds are partial, and the "Bun-native, fastest" pitch isn't worth it for an app where the bottleneck is Postgres + Electric, not the HTTP framework.

**Switching to Hono.** Same target architecture (standalone Bun + HTTP framework + typed RPC to web), same step plan, different framework. Hono is portable across runtimes (Bun, Node, Deno, Cloudflare, Vercel, Lambda), has a much larger install base, ships a typed RPC client (`hc<typeof app>`) that works the same way Eden claims to but actually does, and is conservative about breaking changes. Performance difference is negligible at our scale.

If Elysia 2.0 lands with the type system overhauled and the open issues resolved, it would be worth re-evaluating. Not before.

**What carries over from the Elysia prototype:** the migration plan, the `/api2/*` namespace strategy, `@repo/auth` extraction (step 1, done), the Electric proxy pattern, the auth-middleware pattern, the central `onError` pattern, error mapping, and every route handler's *shape* (validate → call `@repo/domain` inside `withTransaction` → return). Only the framework primitives change (`new Elysia()` → `new Hono()`, `authPlugin` → middleware, `.post(path, handler, { body: schema })` → `.post(path, zValidator('json', schema), handler)`, Eden `treaty<App>` → Hono `hc<App>`).

## Prototype results (Elysia, kept for historical context)

`apps/api/` was built side-by-side with `apps/web/` to validate the approach without touching production paths. Routes live under `/api2/*` (the `/api` namespace is owned by Nitro). One Electric shape proxy, one mutation endpoint, and the AI chat streaming endpoint were ported.

Findings (framework-agnostic — all apply to the Hono version too):

- **Electric SQL proxy** works unchanged. Same `fetch` forwarding pattern, same auth scoping, same headers. The 80-line proxy function copies cleanly into any HTTP framework handler.
- **Domain layer** (`@repo/domain` + `withTransaction` + error classes) carries over with zero changes. Route handlers call domain functions exactly like Start handlers did.
- **AI streaming** with `@tanstack/ai` works untouched. `toServerSentEventsResponse()` returns a plain `Response`, which any modern framework returns directly. Tokens flow.
- **Better Auth** runs cleanly in any standalone server. Same DB and `BETTER_AUTH_SECRET` between the two apps means a session issued by either is accepted by both. In the final state only the api app will own auth.
- **Same-origin in dev over Tailscale** required a small workaround. Nitro claims the entire HTTP layer of the Vite dev server — `server.proxy` in `vite.config.ts` never runs. Solution: a single Start catch-all at `apps/web/src/routes/api2/$.ts` that forwards everything under `/api2` to the api server. This goes away once Start is removed.

The Elysia-specific finding — that `tsc --noEmit` crashes on Eden's recursive `App` type — is what caused the pivot. See "Pivot to Hono" above.

## What the prototype leaves behind

Status per file after the Elysia attempt and ahead of the Hono port:

Throw away or rewrite for Hono:

- `apps/api/src/index.ts` — Elysia entrypoint. Rewrite as Hono app. Keep the structure (CORS, request logging, route mounts, central `onError`) and the error-mapping logic verbatim — only the framework calls change.
- `apps/api/src/middleware/auth.ts` — Elysia `authPlugin` + `requireUser`. Rewrite as Hono middleware that sets `c.set('user', ...)` / `c.set('session', ...)`; `requireUser` becomes a context helper or a separate middleware. The shape (read session, attach to context, throw `AuthError` on miss) stays identical.
- `apps/api/src/routes/shapes.ts` — Electric proxy router. Mechanical rewrite: `new Elysia({ prefix }).get(...)` → `new Hono().get(...)`, mount under prefix at parent.
- `apps/api/src/routes/{actions,article-audio,article-tags,articles,chat-sessions,feed-tags,feeds,filter-rules,settings,tags}.ts` — ten entity routers. Each is `body schema + handler` repeated. Hono uses `zValidator('json', schema)` middleware in place of Elysia's `{ body: schema }` config object. Handlers themselves don't change.
- `apps/api/src/routes/chat.ts` — stripped-down AI streaming stub. Rewrite for Hono. Still not the real endpoint (see below).
- `apps/api/src/client.ts` — change `export type { App }` to whatever Hono needs for `hc<App>` (typically the same `typeof app` export).

Keep as-is:

- `apps/api/package.json` structure, `apps/api/tsconfig.json`, `apps/api/src/env.ts` — swap `elysia` + `@elysiajs/*` deps for `hono` + `@hono/zod-validator`. Otherwise unchanged.
- `apps/web/src/routes/api2/$.ts` — Start-side forwarder. Framework-agnostic. Deleted at step 8.

Throw away outright:

- `apps/api/src/auth.ts` — duplicate Better Auth instance. The whole reason step 1 of the plan exists is to delete this file. Once `@repo/auth` is extracted (done), this becomes `import { auth } from '@repo/auth'` and the file disappears.

Rewrite on the web side:

- `apps/web/src/lib/api-client.ts` — Eden `treaty<App>(...)` becomes Hono `hc<App>(...)`. Call shape changes: `api.api2.feeds.discover.post({ url })` → `client.api2.feeds.discover.$post({ json: { url } })`. The `unwrap()` helper stays (Hono `hc` returns `Response`, so `unwrap` becomes `if (!res.ok) throw ...; return res.json()`).
- Every call site already migrated to Eden during the Elysia attempt (entities, components, routes — listed in the migration commit history) gets a follow-up sweep to switch from Eden's `{ data, error }` shape to Hono's `Response` shape. Mostly find-and-replace.

Other prototype-specific things to note:

- All migrated routes live under `/api2/*` as an intentional ugly placeholder so they cannot be confused for the long-term path. Renamed to `/api/*` at step 8.
- Two `betterAuth()` instances are currently running side-by-side, sharing DB and `BETTER_AUTH_SECRET`. This works but is brittle (config drift between them would cause subtle bugs). Step 1 collapses them into one — done.

## High-level plan

Unchanged from the original Elysia plan. Most server functions are 5 to 20 line wrappers over `@repo/domain` calls. The hard parts (`@repo/domain` itself, Electric SQL, the AI engine) are framework-agnostic packages.

1. **Extract `@repo/auth` first.** [DONE]
2. **Migrate every shape proxy route.** Eight files in `apps/web/src/routes/api/shapes/` — all identical pattern with a different table name. [DONE under Elysia; needs port to Hono.]
3. **Migrate every entity server function.** Ten `*.functions.ts` files in `apps/web/src/entities/`. [DONE under Elysia; needs port to Hono. Call-site migration to Eden is done; needs re-sweep for Hono's `hc` shape.]
4. **Migrate external API routes.** `apps/web/src/routes/api/feeds.ts` (used by the browser extension) and `apps/web/src/routes/api/articles/$articleId/audio.ts`.
5. **Migrate well-known + MCP.** `apps/web/src/server/well-known.server.ts` and `apps/web/src/routes/api/mcp/$.ts`.
6. **Move Better Auth ownership to the api app.** With `@repo/auth` extracted, the api app becomes the authoritative `/api/auth/*` handler. Web's current `/api/auth/$.ts` becomes a forwarder until step 8.
7. **Migrate OAuth provider + consent flow.** Plugin lives inside `betterAuth()` config, moves with `@repo/auth` automatically. Discovery URLs in `.well-known/oauth-authorization-server` must point at the api origin once it owns auth.
8. **Delete everything.** `apps/web/src/server/*`, `apps/web/src/routes/api/`, the `routes/api2/$.ts` forwarder, the Nitro plugin from `vite.config.ts`. Rename `/api2/*` back to `/api/*` on the api app. Drop `nitro` and `@tanstack/solid-start` from web's dependencies. Web becomes a pure Vite SPA.

## Things worth extracting along the way

- **`packages/electric-proxy/`** — the proxy function is reused by every shape endpoint. Currently a single file in web. Pulling it out makes the dependency direction explicit and lets `apps/api/` import it cleanly.
- **AI middleware/tools** — `ai-tools.server.ts`, `ai-persistence.server.ts`, `ai-system-prompt.server.ts`, `ai-analytics.server.ts` are domain logic disguised as server files. They belong in `@repo/domain/ai` (or a new `@repo/ai`). Once moved, `apps/api/` just calls them.

After these extractions, `apps/api/` is mostly routing glue — auth mount, electric proxy mount, route → domain call → response. Which is what an API app should be.

## Order rationale and risk

Step 1 (auth package) is done first because it's a small mechanical change that removes a real smell (two auth instances) and unblocks every later step that touches auth. Otherwise behaviour-neutral. Done.

Auth migration itself (step 6) is deferred because the auth flow is barely used in production today. Migrating it later means most of the risky surface (OAuth, MCP, consent flow) gets touched after the simpler patterns have been validated by repeated use.

Steps 2 to 4 are the bulk of the work but each individual migration is cheap and isolated — one entity function or one shape route at a time, with the call site updated in the same change. Easy to interleave with regular feature work, easy to revert per-endpoint.

Step 8 (delete Start) only happens once everything else is verified working in production. The `/api2` prefix is intentionally ugly so it cannot be confused for the long-term path.

## Open questions

- Deploy story for `apps/api/` — single Bun process? Separate service? Reverse proxy in front of both? Probably matches whatever we already do for `apps/worker/`.
- Whether the browser extension keeps calling `/api/feeds` cross-origin (CORS) or gets pointed at the api origin directly. Either works.

## Non-goals

- Rewriting any business logic. `@repo/domain` is the source of truth and does not change.
- Replacing TanStack Solid Router. SPA mode works; we keep it.
- Replacing TanStack Solid DB / Electric SQL. The whole point of this migration is that the local-first stack is healthy — it's the SSR framework that isn't.
- Re-evaluating Elysia before its 2.0 release.
