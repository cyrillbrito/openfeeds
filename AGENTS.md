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

**Electric SQL Sync:**

- Uses Electric SQL for real-time data synchronization
- Shape-based subscriptions filter data per-user
- See "User ID Denormalization" below for critical schema requirements

**Server Functions:**

- TanStack Start `createServerFn` for data operations
- Auth middleware provides user context
- Calls `@repo/domain` for business logic

**Background Processing:**

- Worker app processes BullMQ jobs
- Redis for queue persistence
- Enqueue jobs via `@repo/domain` functions

**OAuth Provider & MCP:**

- OpenFeeds acts as an OAuth 2.1 Authorization Server for MCP clients (Claude, Cursor, etc.)
- Uses Better Auth `oauthProvider` plugin with dynamic client registration (RFC 7591)
- MCP endpoint at `/api/mcp` with JWT-verified access
- See [docs/oauth-mcp.md](docs/oauth-mcp.md) for full architecture

## Tech Stack

- **Frontend:** SolidJS, TanStack Start, TanStack Solid DB, Tailwind v4, DaisyUI
- **Server:** TanStack Start server functions, Bun runtime
- **Database:** SQLite3, Drizzle ORM
- **Queue:** BullMQ + Redis
- **Auth:** Better Auth
- **Build:** Turborepo, Vite
- **Testing:** Playwright

## Environment & Configuration

**Each package owns and validates its own environment variables using t3-env.** Apps only define env vars they use directly; shared infrastructure config (database, Redis, PostHog, etc.) is owned by the packages that use it.

### Pattern Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Package (@repo/db, @repo/domain)                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ src/env.ts - t3-env validates package's own env vars        │ │
│ │ src/config.ts - exports db, redisConnection, etc. directly  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ App (web, worker)                                               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ src/env.ts - t3-env for app-specific env vars only          │ │
│ │ Imports db, redisConnection, etc. directly from packages    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Packages: Own Their Environment Variables

Each package defines and validates the env vars it needs:

```typescript
// packages/db/src/env.ts
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DATABASE_URL: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

```typescript
// packages/db/src/config.ts - exports db directly
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from './env';

export const db = drizzle(env.DATABASE_URL, { schema });
```

### Apps: Define Their Own Env Vars

Apps validate env vars they use directly. An env var (e.g., `POSTHOG_PUBLIC_KEY`) may appear in multiple `env.ts` files if each consumer uses it independently — this is fine and preferred over creating cross-package imports just to share a value.

```typescript
// apps/web/src/env.ts - web-specific vars
export const env = createEnv({
  server: {
    ELECTRIC_URL: z.string().default('http://localhost:3060'),
    BETTER_AUTH_SECRET: z.string(),
    SIMPLE_AUTH: z.stringbool().default(false),
    TRUSTED_ORIGINS: z.string().transform(...),
    POSTHOG_PUBLIC_KEY: z.string().optional(), // also in @repo/domain, but used here to expose to client
  },
  ...
});
```

### Usage in Apps

```typescript
// Import directly from packages - no init ceremony needed
import { db } from '@repo/db';
import { QUEUE_NAMES, redisConnection } from '@repo/domain';
```

### Key Rules

1. **Each consumer validates what it needs** - Packages and apps define env vars in their own `env.ts`
2. **Duplication is okay** - The same env var can appear in multiple `env.ts` files when each consumer uses it independently
3. **Direct exports** - `db`, `redisConnection`, `posthog` are module-level exports, no getters
4. **No init functions** - Packages initialize on import via t3-env
5. **Fail fast** - Invalid env vars throw at import time

## Version Control (GitButler)

**This repo uses GitButler workspace mode. Use `but` commands instead of `git` for all write operations.**

Load the `but` skill for full command reference and workflows.

**Always group changes into a relevant branch.** Before committing, check if a branch already exists for the type of work you're doing (`but status --json`). If one exists, commit there. If not, create a new branch (`but branch new <name>`).

**Example workflow:**

```bash
but status --json                                          # Check existing branches
but branch new add-tag-filtering                           # Create branch if needed
# ... make changes ...
but status --json                                          # Get file/change IDs
but commit add-tag-filtering -m "Add tag filter" --changes <id>,<id>  # Commit specific files
but push add-tag-filtering                                 # Push branch to remote
but pr new add-tag-filtering -F /tmp/pr.md                 # Create PR from file
```

**Creating pull requests:**

Use `but pr new <branch>` — NOT `gh pr create`. The `but` command handles authentication via SSH (which is configured), while `gh` may have expired tokens.

**PR titles MUST follow [Conventional Commits](https://www.conventionalcommits.org/) format.** This is enforced by CI (`action-semantic-pull-request`) and used by Release Please to auto-generate changelogs and version bumps.

Format: `type: description` or `type(scope): description`

Common types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `ci`, `build`

Examples: `feat: add tag filtering`, `fix: resolve undefined tag in header`, `chore: update dependencies`

- **Non-interactive mode:** Must provide one of: `-m` (message), `-F` (file), or `-t` (default/auto).
- **Recommended: use `-F <file>`** — Write PR title and description to a temp file, then pass it. First line = title, rest = body. This avoids shell escaping issues with `-m`.
- `-t` (default) uses the commit message(s) as title/description automatically.

```bash
# Option 1: Write to temp file (recommended for multi-line descriptions)
# First line = PR title (must be Conventional Commits format), remaining lines = PR body
cat > /tmp/pr.md << 'EOF'
fix: resolve tag page header showing undefined

- Fix tag page displaying "Tag #undefined" in the header
- Switch from deprecated .data to accessor pattern
EOF
but pr new my-branch -F /tmp/pr.md

# Option 2: Use default commit message as PR content
but pr new my-branch -t

# Option 3: Inline message (single line only, avoid special chars)
but pr new my-branch -m "fix: resolve undefined tag in header"
```

**Key rules:**

- Use `but` for all write operations (commit, branch, push, PRs). Read-only git commands (`git log`, `git diff`) are fine.
- Commit early and often -- GitButler makes editing history trivial (`squash`, `absorb`, `reword`).
- **Never use `but amend` or `but absorb` unless explicitly asked.** Always create new commits. This preserves history visibility so changes can be reviewed incrementally.
- **ALWAYS use `--changes <id>,<id>` to commit only the specific files you changed.** Never commit without `--changes` — omitting it commits ALL uncommitted changes (including unrelated files from other tools or branches). Run `but status --json` first to get the correct file IDs.
- Keep branches focused: one theme/feature per branch.

## Code Quality

- Never modify tsconfig or use `// @ts-ignore`
- Run `bun check-types` after changes
- TypeScript strict mode enabled
- Lint with oxlint (type-aware)

## User ID Denormalization

**Every table must have a `user_id` column with an index.**

This is required because:

1. **Electric SQL limitation**: Shape where clauses cannot perform JOINs or subqueries. You can only filter on columns that exist directly on the table.

2. **Multi-tenant filtering**: All data is filtered by user. Without `user_id` on junction tables (like `article_tags`), we'd need to build `WHERE article_id IN (...)` clauses with potentially thousands of IDs, causing HTTP 414 (URI Too Long) errors.

3. **Query performance**: Indexes on `user_id` enable fast filtering for both Electric sync and server-side queries.

**Pattern:**

```typescript
// Junction tables MUST include user_id
export const articleTags = pgTable(
  'article_tags',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('article_tags_user_id_idx').on(table.userId), // Always index user_id
    // ... other indexes
  ],
);
```

**Electric SQL documentation reference:**

> "For multi-level include trees, you can denormalise the filtering column onto the lower tables so that you can sync with a simple where clause."
> — https://electric-sql.com/docs/guides/shapes#include-tree-workarounds

**Checklist for new tables:**

- [ ] Add `user_id` column with foreign key to `user.id`
- [ ] Add `index('table_name_user_id_idx').on(table.userId)`
- [ ] Include `userId` in insert operations
- [ ] Update shape handlers to filter by `user_id`
