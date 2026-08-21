# CLAUDE.md

## What this is

OpenFeeds v2 — a full rewrite of a self-hosted, multi-user RSS reader. This branch has its own
history and **no application code yet**.

- [README.md](README.md) — what the product is and does
- [docs/v2-plan.md](docs/v2-plan.md) — **read this before proposing anything**: settled
  decisions, open questions, and the reasoning behind both
- v1 is on `main`, with unrelated history but readable from here: `git show main:<path>`

## The one rule that matters right now

**Several foundational choices are deliberately undecided. Do not resolve them by writing code.**

Open: the frontend framework (Solid 2 vs React) and the UI component layer · the runtime
(Bun vs Node) · database layout (one shared DB vs one per user) · whether feed fetching is
shared across users · the testing approach.

Scaffolding a project picks all of these implicitly. If a task requires one of them, **say so and
ask** rather than choosing. The plan doc explains what each decision costs.

## Settled constraints

These hold regardless of how the open questions land:

- **Self-hostable.** Anything requiring a hosted-only service is out, no matter how convenient.
  This is what ruled out Clerk and Turso Sync.
- **SQLite.** One file. Not Postgres.
- **No sync engine.** Plain endpoints and a query cache. v1's local-first layer is gone.
- **No job queue.** Scheduled work runs in the app process. No Redis, no separate worker.
- **Workspaces, but minimal.** A monorepo for the app plus the browser extension — no Turborepo,
  and none of v1's package sprawl.
- **Tailwind** for styling.

## Working here

- v2 is a rewrite, not a port. v1 code is a **reference**, not a source to copy from.
- Prefer boring over clever — v1 failed on complexity, not on capability.
- Ask before adding a dependency that becomes load-bearing.
- Conventions, file layout and commands get documented here once there's code worth describing.
  Don't invent them ahead of time.
