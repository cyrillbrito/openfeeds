# CLAUDE.md

## What this is

OpenFeeds v2 — a full rewrite of a self-hosted, multi-user RSS reader. This branch has its own
history. It works end to end: sign up, subscribe to a feed, fetch and parse it on a cron, read
the inbox, and watch the YouTube Shorts it carries on a screen of their own. Multi-user, with
Better Auth and per-user subscriptions and read state.

- [README.md](README.md) — what the product is and does
- [docs/v2-plan.md](docs/v2-plan.md) — **read this before proposing anything**: settled
  decisions, open questions, and the reasoning behind both
- [docs/shorts-viewer.md](docs/shorts-viewer.md) — the shorts feature: how detection works, what
  was built in its simplest form, and what was deliberately left out
- v1 is on `main`, with unrelated history but readable from here: `git show main:<path>`

## Multi-user, in one paragraph

`feeds` and `articles` are **global**: one row per canonical feed URL, one per entry, fetched
once however many people subscribe. Per-user data is two tables — `subscriptions` (the sidebar)
and `article_state` (read/archived, absent row = unread). So an article is visible because the
user follows its feed, never because of a column on the article.

Every function in `server/feeds/queries.ts` takes `userId` first, and it comes from the session
in `server/require-user.ts` — never from a client argument. `src/middleware.ts` redirects
anonymous document requests to `/signin`; that is navigation, and the queries are the actual
boundary. Adding a query that reads `articles` without joining `subscriptions` is the way to
break this.

Still open (docs/v2-plan.md): whether to back the convention with Postgres RLS.

## Stack

- **Bun 1.4** — runtime and package manager, committed to, `bun:*` APIs included. Node works too
  (floor 20.19+ / 22.12+) but isn't the target.
- **Solid 2** (RC) via `@solidjs/vite-plugin` **start mode**. SolidStart is retired — don't reach
  for it, and treat most SolidStart material online as describing the old thing.
- **Vite 8**, **Vitest 4**, **oxlint**.
- **SQLite** via `bun:sqlite` + **Drizzle**; migrations run at boot. **Tailwind 4** (Vite plugin,
  no config file). **Better Auth** `1.7.5` — `src/server/auth.ts`, mounted at
  `src/routes/api/auth/[...all].ts`, its four tables in `db/schema.ts`. Email+password always
  on, Google when its two env vars are set. No mailer, so no verification, reset, or magic link.
- **UI: Kobalte `2.0.0-alpha.0`** (the Solid 2 line) with shadcn components **vendored** into
  `src/components/ui`. They are our source files, not a dependency. The shadcn-for-Solid ports all
  target Kobalte 0.13 / Solid 1, so their code is a starting point that must be retargeted.
- **feedsmith** for parsing. It preserves each format's own structure rather than normalising, so
  `src/server/feeds/normalize.ts` is ours and is where the RSS/Atom/RDF/JSON differences live.
- **Feed resolution** — `src/server/feeds/discover.ts` turns a pasted homepage into a feed URL.
  Reads `<head>` with **`HTMLRewriter`**, a Bun global, so that file is the one place the "Node
  works too" note above does not hold. No HTML-parsing dependency. v1's `packages/discovery`
  (happy-dom, ~700 LOC) is a cautionary reference, not a source — the module comment names the
  bugs its stage ordering was designed to make unwriteable.

Coordinated-RC packages are **pinned exact** in `apps/web/package.json`; carets pull mismatched
prereleases. Unpin when Solid 2 goes stable.

## Layout

```
apps/web/         # the app — Solid 2 start mode
  src/server/**   # server-only; the `server-only` marker fails the build if it leaks clientward
apps/extension/   # browser extension (empty)
packages/shared/  # API types + client (empty) — stays exactly one package
```

## Commands

`bun install` from the repo root; the rest from `apps/web`:

```
bun run dev        # vite dev server (port 3000)
bun run build      # client + SSR build
bun run test       # vitest — client (jsdom) + server projects
bun run lint       # oxlint
bun run typecheck  # tsc --noEmit
bun run start      # production server against dist/
bun run db:generate --name add_x   # schema.ts -> drizzle/000N_add_x.sql
```

Gotchas:

- **Every script runs `bun --bun`, on purpose.** The `vite` and `vitest` binaries carry
  `#!/usr/bin/env node` shebangs, so a plain `bun run dev` executes under **Node** — where
  `bun:sqlite` fails to resolve and `Bun.cron` is undefined (it silently falls back to
  `setInterval`). `src/server/runtime.test.ts` guards this.
- **`jsdom` is capped at 29.** 30.x throws `'addEventListener' called on an object that is not a
  valid instance of EventTarget` when Vitest sets up the jsdom environment under `bun --bun` —
  every client test file dies at setup and Vitest still exits reporting the server files as
  passing. Not a Vitest bug: 4 and 5 both fail identically, 29 passes on both.
- The dev server only SSRs requests whose `Accept` includes `text/html`. `curl` sends `*/*` and
  gets a Vite 404 — pass `-H 'Accept: text/html'` or you'll misdiagnose dev as broken.
- `apps/web/.env` (gitignored) needs `BETTER_AUTH_SECRET` (32+ chars); see `.env.example`.
- `bunx drizzle-kit migrate` does not work — it wants a node Postgres driver and the app uses
  `Bun.SQL`. Migrations apply at boot, so one request to `bun run dev` runs them.
- The Better Auth CLI (`bunx auth@latest generate`) cannot load `src/server/auth.ts`: jiti does
  not resolve `server-only` or `virtual:env/server`. Point `--config` at a throwaway file that
  repeats only the table-affecting options.
- `run lint`/`run test` do not typecheck. Run `bun run typecheck` — several Solid 2 traps below
  are type-only and invisible to both.

## Solid 2 traps

RC software, and most material online describes retired APIs. Verified against `node_modules`:

- `splitProps`/`mergeProps` are **gone** → `omit(props, 'a', 'b')` (variadic, returns only the
  rest) and `merge(defaults, props)`. Read the kept keys straight off `props`.
- `ValidComponent`, `ComponentProps` and `JSX` must come from **`@solidjs/web`**. `solid-js` still
  exports a `ValidComponent`, but it is `Component<any>` and rejects intrinsic tags — it compiles
  at the import and fails at the use site. (`solid/imports` lint rule is off for this reason.)
- No `classList` → `class={['base', { toggled: cond() }]}`.
- No `createAsync`/`createResource`/`Suspense` → `createMemo(() => someQuery())` plus a
  `<Loading>` boundary. `<ErrorBoundary>` is `<Errored>`.
- A `<Loading>` that has already rendered content **holds that content** the next time its
  data goes pending — it does not return to its fallback. Right for revalidation, wrong for
  navigation: a route whose component survives a param change (`/feeds/1` → `/feeds/2`) keeps
  the old screen until the new data lands. Pass `on={props.params.id}` to key the boundary and
  it falls back immediately. Crossing to a *different* route needs no `on` — that mounts a
  fresh boundary. `isPending(() => memo())` is the third mode: an inline "updating" affordance
  that keeps the current content; it performs the read, so it must sit under the same boundary.
- No `solid-js/store` subpath — `createStore`/`reconcile` are on the root export. This breaks
  `better-auth/solid`, hence the vanilla client in `src/lib/auth-client.ts`.
- `redirect`/`reload`/`respond`/`markSafeError` come from `@solidjs/web`, not the router.
- `createEffect` takes **two** arguments (track, then act).
- No `onMount`. `onCleanup` survives, `onMount` does not — reach for
  `createEffect(() => trigger, () => …)` instead, which also gives you the
  re-run on navigation you usually wanted anyway. Effects never run during SSR,
  so that is also where DOM measurement belongs. Its act callback owns **no cleanup
  scope**: `onCleanup` in there warns `NO_OWNER_CLEANUP` and never runs. Register listeners
  from the component body instead, guarded by `isServer` (`@solidjs/web`) so SSR skips them.
- Passing an **element** child to the vendored `Button` (an `<svg>`, even a `<span>`) leaves an
  unclaimed node at hydration. Plain text children are fine, which is why nothing tripped over
  it until the first icon.
- `query()` reads router context — calling one above `<Router>` throws during SSR.
- Actions must scope revalidation (`reload({ revalidate: [...] })`) or **every** cached query
  refetches. Revalidation matches by **prefix**, so query names must not prefix one another.
- A thrown error in a form-submitted action lands on `Submission.error`, not `<Errored>`; plain
  `throw new Error(msg)` is sanitized to "Internal Server Error". Return a result object or use
  `markSafeError`.
- Drizzle renders columns **unqualified** when one table is in scope, which silently breaks
  correlated subqueries. Use a join.

## Working here

- v2 is a rewrite, not a port. v1 code is a **reference**, not a source to copy from.
- Prefer boring over clever — v1 failed on complexity, not on capability.
- **Comments state facts, not justifications.** Say what the code does and what constraint it
  obeys. Don't argue for the choice, don't compare with v1, don't narrate the alternatives
  considered. A few lines per file, not a preamble.
- Ask before adding a dependency that becomes load-bearing.
- No Turborepo. Plain Bun workspaces; `bun run --filter` to span packages.
- No detail page and no content extraction: a row links straight to its source (`_blank`, marks
  read on click). The shorts viewer is the one in-app screen. Nothing renders remote HTML, which
  is why `sanitize-html.ts` no longer exists — bring it back parser-based if a reader pane does.
