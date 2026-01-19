# OpenFeeds

A **local-first RSS reader** built with SolidJS and TanStack Start. Data syncs optimistically to a local database with server persistence.

# Development Rules

## Commands

**Use bun only (not npm/pnpm/yarn):**

```bash
bun dev          # Start dev servers
bun build        # Build all apps
bun check-types  # TypeScript checking
bun lint         # oxlint type-aware linting
bun checks       # Type check + lint
bun migrate      # Run database migrations
```

When DB migrations are needed, ask the user to run them for security reasons.

## Monorepo Structure

Each app/package has its own `AGENTS.md` with specific patterns and guidelines.

### Apps

| App               | Description                          | Details                        |
| ----------------- | ------------------------------------ | ------------------------------ |
| `apps/web/`       | SolidJS + TanStack Start (main app)  | See `apps/web/AGENTS.md`       |
| `apps/server/`    | **DEPRECATED** - Elysia API          | See `apps/server/AGENTS.md`    |
| `apps/worker/`    | BullMQ background job processor      | See `apps/worker/AGENTS.md`    |
| `apps/migrator/`  | Database migration runner            | -                              |
| `apps/e2e/`       | Playwright tests + visual regression | See `apps/e2e/AGENTS.md`       |
| `apps/extension/` | Browser extension for feed discovery | See `apps/extension/AGENTS.md` |
| `apps/marketing/` | Marketing website                    | -                              |

### Packages

| Package               | Description                         | Details                            |
| --------------------- | ----------------------------------- | ---------------------------------- |
| `packages/db/`        | Drizzle ORM + SQLite3 schemas       | See `packages/db/AGENTS.md`        |
| `packages/domain/`    | Business logic + queue management   | See `packages/domain/AGENTS.md`    |
| `packages/discovery/` | RSS/Atom feed discovery             | See `packages/discovery/AGENTS.md` |
| `packages/shared/`    | Cross-app utilities, types, schemas | -                                  |
| `packages/emails/`    | React Email templates               | See `packages/emails/AGENTS.md`    |
| `packages/scripts/`   | CLI utilities (e.g., create-user)   | -                                  |

## Architecture

**Local-First Pattern:**

- Client-side TanStack Solid DB with collections
- Optimistic updates → server sync via server functions
- Entities defined in `apps/web/src/entities/`

**Server Functions:**

- TanStack Start `createServerFn` for data operations
- Auth middleware provides user context
- Calls `@repo/domain` for business logic
- **All new API endpoints should be added here, not in Elysia**

**Background Processing:**

- Worker app processes BullMQ jobs
- Redis for queue persistence
- Enqueue jobs via `@repo/domain` functions

## Tech Stack

- **Frontend:** SolidJS, TanStack Start, TanStack Solid DB, Tailwind v4, DaisyUI
- **Server:** TanStack Start server functions, Bun runtime
- **Database:** SQLite3, Drizzle ORM
- **Queue:** BullMQ + Redis
- **Auth:** Better Auth
- **Build:** Turborepo, Vite
- **Testing:** Playwright

## Code Quality

- Never modify tsconfig or use `// @ts-ignore`
- Run `bun check-types` after changes
- TypeScript strict mode enabled
- Lint with oxlint (type-aware)
