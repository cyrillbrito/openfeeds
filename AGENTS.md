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

## Tech Stack

- **Frontend:** SolidJS, TanStack Start, TanStack Solid DB, Tailwind v4, DaisyUI
- **Server:** TanStack Start server functions, Bun runtime
- **Database:** SQLite3, Drizzle ORM
- **Queue:** BullMQ + Redis
- **Auth:** Better Auth
- **Build:** Turborepo, Vite
- **Testing:** Playwright

## Environment & Configuration

**Apps own environment variables, packages receive configuration via init functions.**

### Pattern Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ App (web, worker)                                               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ src/env.ts - t3-env defines & validates env vars            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│                              ▼                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Entry point (server.ts, index.ts)                           │ │
│ │   initDb({ dbPath: env.DB_PATH })                           │ │
│ │   initDomain({ dbPath, redis, ... })                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│ Package (@repo/db, @repo/domain)                                │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ config.ts - initX() stores config, getX() retrieves it      │ │
│ │ No process.env access - config injected at runtime          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Apps: Define Environment Variables

Each app defines its own env vars using `@t3-oss/env-core` with Zod validation:

```typescript
// apps/web/src/env.ts
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    DB_PATH: z.string().default('./dbs'),
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().default(6379),
    RESEND_API_KEY: z.string().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

### Apps: Initialize Packages at Startup

App entry points call `initDb()` and `initDomain()` before any other code:

```typescript
// apps/web/src/server.ts
import { initDb } from '@repo/db';
import { initDomain } from '@repo/domain';
import { env } from './env';

// Initialize packages - initDb() must be called before initDomain()
initDb({ dbPath: env.DB_PATH });

initDomain({
  dbPath: env.DB_PATH,
  redis: { host: env.REDIS_HOST, port: env.REDIS_PORT },
  resendApiKey: env.RESEND_API_KEY,
});

// ... rest of app setup
```

### Packages: Export Init Functions

Packages expose `initX()` to receive config and `getX()` to access it:

```typescript
// packages/db/src/config.ts
export interface DbConfig {
  dbPath: string;
}

let _config: DbConfig | null = null;

export function initDb(config: DbConfig): void {
  if (_config) throw new Error('Db already initialized');
  _config = config;
}

export function getDbConfig(): DbConfig {
  if (!_config) throw new Error('Db not initialized. Call initDb() first.');
  return _config;
}
```

### Key Rules

1. **Packages never read `process.env`** - They receive config via init functions
2. **Apps own all env var definitions** - Using t3-env for validation
3. **Init order matters** - `initDb()` before `initDomain()`
4. **Init once at startup** - Before any imports that use the config
5. **Fail fast** - Accessing config before init throws immediately

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

- **Non-interactive mode:** Must provide one of: `-m` (message), `-F` (file), or `-t` (default/auto).
- **Recommended: use `-F <file>`** — Write PR title and description to a temp file, then pass it. First line = title, rest = body. This avoids shell escaping issues with `-m`.
- `-t` (default) uses the commit message(s) as title/description automatically.

```bash
# Option 1: Write to temp file (recommended for multi-line descriptions)
# First line = PR title, remaining lines = PR body
cat > /tmp/pr.md << 'EOF'
Fix tag page header showing undefined

- Fix tag page displaying "Tag #undefined" in the header
- Switch from deprecated .data to accessor pattern
EOF
but pr new my-branch -F /tmp/pr.md

# Option 2: Use default commit message as PR content
but pr new my-branch -t

# Option 3: Inline message (single line only, avoid special chars)
but pr new my-branch -m "Fix: resolve undefined tag in header"
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
