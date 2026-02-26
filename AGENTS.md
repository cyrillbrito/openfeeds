# OpenFeeds

Local-first RSS reader built with SolidJS + TanStack Start. Client-side TanStack Solid DB with Electric SQL sync and server persistence.

## Commands

**Use bun only (not npm/pnpm/yarn):**

```bash
bun dev          # Start dev servers
bun build        # Build all apps
bun check-types  # TypeScript checking
bun lint         # oxlint type-aware linting
bun checks       # Type check + lint
bun migrate      # Run database migrations

# Migration generation (from repo root)
bun --cwd packages/db drizzle-kit generate --name <migration-name>
```

When DB schema changes are made, suggest the migration generation command to the user with a descriptive `--name` (e.g. `--name add-bookmarks-table`, `--name uuid-v7-migration`). Do not run it yourself. After generation, suggest `bun migrate` to apply.

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

- **Local-first:** Client-side TanStack Solid DB collections with Electric SQL sync. Entities in `apps/web/src/entities/`
- **Server functions:** TanStack Start `createServerFn` with auth middleware, calls `@repo/domain`
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

This repo uses GitButler workspace mode. Use `but` CLI for all version control operations. Load the `but` skill for command reference.

## Code Quality

- Never modify tsconfig or use `// @ts-ignore`
- Run `bun check-types` after changes
- TypeScript strict mode enabled
- Lint with oxlint (type-aware)

## User ID Denormalization

**Every table must have a `user_id` column with an index.** Electric SQL shapes cannot JOIN/subquery, so all tables need `user_id` directly for per-user filtering. See `packages/db/AGENTS.md` for full pattern, checklist, and code examples.
