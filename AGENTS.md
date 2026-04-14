# OpenFeeds

Local-first RSS reader built with SolidJS + TanStack Start. Client-side TanStack Solid DB with Electric SQL sync and server persistence.

## Commands

**Use bun only (not npm/pnpm/yarn).** Run `bun checks` after every change. Ask the user before running `bun migrate`.

For database schema changes and migrations, load the `database` skill.

## Monorepo Structure

Each app/package has its own `AGENTS.md` with specific patterns and guidelines.

**Apps:**

- `apps/web/` — SolidJS + TanStack Start
- `apps/worker/` — BullMQ jobs
- `apps/migrator/` — DB migrations
- `apps/e2e/` — Playwright tests
- `apps/extension/` — browser extension
- `apps/marketing/` — marketing site

**Packages:**

- `packages/db/` — Drizzle ORM + PostgreSQL
- `packages/domain/` — business logic + queues
- `packages/discovery/` — RSS feed discovery
- `packages/shared/` — utilities + types
- `packages/emails/` — React Email templates
- `packages/scripts/` — CLI utilities

## Architecture

- **Local-first:** Client-side TanStack Solid DB collections with Electric SQL sync. Entities in `apps/web/src/entities/`. Load the `new-entity` skill when adding features.
- **Server functions:** TanStack Start `createServerFn` with auth middleware, calls `@repo/domain` with explicit context.
- **Background jobs:** BullMQ queues (owned by `@repo/domain`), processed by `apps/worker/`
- **Error handling:** Domain errors are transport-agnostic. See [docs/error-handling.md](docs/error-handling.md)
- **OAuth/MCP:** OAuth 2.1 Authorization Server for MCP clients via Better Auth. See [docs/oauth-mcp.md](docs/oauth-mcp.md)

## Environment & Configuration

Each package/app owns and validates its own env vars using t3-env in `src/env.ts`.

1. **Each consumer validates what it needs** — packages and apps define env vars in their own `env.ts`
2. **Duplication is okay** — same env var can appear in multiple `env.ts` files
3. **Direct exports** — `db`, `redisConnection`, `posthog` are module-level exports, no getters
4. **No init functions** — packages initialize on import via t3-env
5. **Fail fast** — invalid env vars throw at import time

## Version Control (GitButler)

This repo uses GitButler workspace mode. Use `but` CLI for **all** version control operations — commits, pushes, branches, and PRs. Prefer `but` over `git` write commands and `gh pr create`. Load the `but` skill for command reference.

Commit messages and PR titles must use [Conventional Commits](https://www.conventionalcommits.org/) (`type(scope): description`). Enforced by CI; used by Release Please for changelogs. PR titles should describe the problem solved or behavior changed, not the technical implementation — they appear in user-facing changelogs.

## Code Quality

- Never modify tsconfig or use `// @ts-ignore`
- Run `bun checks` after changes (lint + format check, includes type checking)
- TypeScript strict mode enabled

## Documentation Index

Load the relevant doc when working in these areas. Docs are in `docs/`.

- `docs/error-handling.md` — Adding error types, changing error boundaries, auth errors, PostHog exception capture, or DB error handling
- `docs/auth-guards.md` — Working on route guards, login/sign-out flows, session cookie checks, or auth middleware
- `docs/posthog.md` — Adding analytics events, exception capture, or changing PostHog setup
- `docs/data-layer.md` — Working with TanStack DB collections, Electric SQL sync, or optimistic mutations
- `docs/domain-context.md` — Writing domain functions that mutate data, using transactions, or wiring `withTransaction`
- `docs/feed-sync.md` — Working on feed sync jobs, retry logic, or feed health tracking
- `docs/oauth-mcp.md` — Working on OAuth 2.1 / MCP server, consent flow, or Better Auth OAuth provider plugin
- `docs/migration-architecture.md` — Running or writing database migrations
- `docs/premium-plan.md` — Working on plan limits, billing, or free vs paid feature gating
- `docs/onboarding-emails.md` — Working on email sequences, React Email templates, or post-signup flows
- `docs/session-read-tracking.md` — Working on article read state or session-based tracking
- `docs/scroll-restoration.md` — Working on article list navigation or scroll position persistence
- `docs/recommendation-system.md` — Working on article ranking, recommendations, or personalisation
- `docs/ai-chat.md` — Working on the AI chat feature, tool calling, or conversation persistence
- `docs/tanstack-db-0.6-upgrade-notes.md` — Upgrading or debugging TanStack DB collection behaviour after a version bump

## User ID Denormalization

**Every table must have a `user_id` column with an index.** Electric SQL shapes cannot JOIN/subquery, so all tables need `user_id` directly for per-user filtering. Load the `database` skill for the full checklist and code examples.

<!-- intent-skills:start -->
# Skill mappings - when working in these areas, load the linked skill file into context.
skills:
  - task: "adding a new synced entity or feature end-to-end with Electric SQL and TanStack DB"
    load: "node_modules/@electric-sql/client/skills/electric-new-feature/SKILL.md"
  - task: "setting up or modifying Electric shape proxy routes with auth"
    load: "node_modules/@electric-sql/client/skills/electric-proxy-auth/SKILL.md"
  - task: "configuring ShapeStream options, type parsers, or column mappers on a collection"
    load: "node_modules/@electric-sql/client/skills/electric-shapes/SKILL.md"
  - task: "creating or modifying a TanStack DB collection (electricCollectionOptions, sync, autoIndex)"
    load: "node_modules/@tanstack/db/skills/db-core/collection-setup/SKILL.md"
  - task: "writing optimistic mutations (onInsert, onUpdate, onDelete, txid handshake)"
    load: "node_modules/@tanstack/db/skills/db-core/mutations-optimistic/SKILL.md"
  - task: "writing live queries with useLiveQuery, query builder, joins, or aggregates"
    load: "node_modules/@tanstack/db/skills/db-core/live-queries/SKILL.md"
  - task: "adding route guards, auth protection, or authenticated layout routes"
    load: "node_modules/@tanstack/router-core/skills/router-core/auth-and-guards/SKILL.md"
  - task: "adding loaders, beforeLoad, or data fetching patterns to routes"
    load: "node_modules/@tanstack/router-core/skills/router-core/data-loading/SKILL.md"
  - task: "debugging Electric sync issues (shapes not updating, errors in console)"
    load: "node_modules/@electric-sql/client/skills/electric-debugging/SKILL.md"
  - task: "adding or reading search params in routes"
    load: "node_modules/@tanstack/router-core/skills/router-core/search-params/SKILL.md"
<!-- intent-skills:end -->
