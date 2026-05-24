# Database Package - Drizzle ORM

Drizzle ORM with PostgreSQL. Two separate schemas: user data and auth (Better Auth).

## Architecture

- **User Schema:** RSS feeds, articles, tags, read status — `drizzle.config.ts`
- **Auth Schema:** Better Auth tables (users, sessions) — `drizzle-auth.config.ts`
- **Direct import:** `import { db, feeds } from '@repo/db'` — no init functions, validates env on import

Load the `database` skill for migration workflow, ID strategy, user_id denormalization checklist, and domain context patterns.

## Key Rules

- **All user-data PKs:** `uuid().default(sql`uuidv7()`).primaryKey()`
- **Every table MUST have `user_id`** with an index (Electric SQL requirement)
- **Never modify migration files manually.** Migrations run automatically on server boot via `runMigrations()` (called from `apps/server/src/index.ts`); `bun migrate` is the manual CLI for out-of-band runs.

## Electric SQL

Runs in automatic mode — manages publications, replica identity, and subscriptions automatically.
