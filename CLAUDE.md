# CLAUDE.md

## What this is

OpenFeeds v2 — a full rewrite of a self-hosted, multi-user RSS reader. This branch has its own
history. The app is scaffolded; there is no feature code yet.

- [README.md](README.md) — what the product is and does
- [docs/v2-plan.md](docs/v2-plan.md) — **read this before proposing anything**: settled
  decisions, open questions, and the reasoning behind both
- v1 is on `main`, with unrelated history but readable from here: `git show main:<path>`

## Still undecided — don't resolve these by writing code

**The UI component layer** (Kobalte, or one of the shadcn-for-Solid ports on top of it) ·
**database layout** (one shared DB vs one per user) · **whether feed fetching is shared across
users**.

If a task requires one of them, **say so and ask**. The plan doc explains what each costs.

## Stack

- **Bun 1.4** — runtime and package manager, committed to, `bun:*` APIs included. Node works too
  (floor 20.19+ / 22.12+) but isn't the target.
- **Solid 2** (RC) via `@solidjs/vite-plugin` **start mode**. SolidStart is retired — don't reach
  for it, and treat most SolidStart material online as describing the old thing.
- **Vite 8**, **Vitest 4**, **oxlint**.
- **SQLite** (Drizzle), **Tailwind**, **Better Auth** — settled, not yet installed.

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
bun run dev      # vite dev server (port 3000)
bun run build    # client + SSR build
bun run test     # vitest — client (jsdom) + server (node) projects
bun run lint     # oxlint
bun run start    # production server against dist/
```

Gotchas:

- The dev server only SSRs requests whose `Accept` includes `text/html`. `curl` sends `*/*` and
  gets a Vite 404 — pass `-H 'Accept: text/html'` or you'll misdiagnose dev as broken.
- `apps/web/.env` (gitignored) needs `SESSION_SECRET`; see `.env.example`.

## Working here

- v2 is a rewrite, not a port. v1 code is a **reference**, not a source to copy from.
- Prefer boring over clever — v1 failed on complexity, not on capability.
- Ask before adding a dependency that becomes load-bearing.
- No Turborepo. Plain Bun workspaces; `bun run --filter` to span packages.
