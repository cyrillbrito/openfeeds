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
```

When DB migrations are needed, ask the user to run them for security reasons.

## Monorepo Structure

Each app/package has its own `AGENTS.md` with specific patterns and guidelines.

### Apps

| App               | Description                          | Details                     |
| ----------------- | ------------------------------------ | --------------------------- |
| `apps/web/`       | SolidJS + TanStack Start frontend    | See `apps/web/AGENTS.md`    |
| `apps/server/`    | Elysia API (auth, background jobs)   | See `apps/server/AGENTS.md` |
| `apps/worker/`    | BullMQ background job processor      | See `apps/worker/AGENTS.md` |
| `apps/e2e/`       | Playwright tests + visual regression | See `apps/e2e/AGENTS.md`    |
| `apps/marketing/` | Marketing website                    | -                           |

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

**Background Processing:**

- Elysia server handles auth and job enqueueing
- Worker app processes BullMQ jobs
- Redis for queue persistence

## Tech Stack

- **Frontend:** SolidJS, TanStack Start, TanStack Solid DB, Tailwind v4, DaisyUI
- **Server:** TanStack Start server functions, Elysia (auth/jobs), Bun runtime
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

## Branch Management (GitButler)

**GitButler (`but`) is the primary git workflow tool for this project.**

- Use `but` commands for all branching, staging, and committing operations
- Git commands (`git`) can be used for read-only operations (log, diff, blame, etc.)
- When user mentions commits, branches, or staging → use GitButler, not git

**Every development task uses a dedicated branch. Files are staged to branches, never committed by AI.**

### Workflow

1. **At task start**: Check for related branches, suggest names if none exist, ask user which to use
2. **Create branch if needed**: Run `but branch new <name>` when user approves
3. **After file changes**: Run `but mark <branch-name>` to stage files to the branch
4. **Never commit**: User creates commits manually

### Commands

```bash
but status                    # Check current branches and file assignments
but branch new <name>         # Create new branch (if needed)
but mark <branch-name>        # Assign modified files to branch (no commit)
but unmark                    # Remove branch marking
```

### Examples

**Single feature:**

```
User: "Add RSS feed validation"
AI: "I'll use branch 'feature/feed-validation' - should I create it or does it exist?"
AI: <makes changes to 3 files>
AI: "Staged validation logic to feature/feed-validation. Files: parser.ts, schema.ts, validator.ts"
```

**Multiple agents/branches:**

```
Agent 1 working on 'feature/auth' → marks branch, modifies auth files
Agent 2 working on 'fix/parser'  → marks branch, modifies parser files
User can see which files belong to which feature via `but status`
User creates commits when ready
```

### Key Rules

- AI stages files (`but mark`) but never commits
- One branch per logical feature/fix
- User controls commit boundaries
- Multiple agents can work on different branches simultaneously
