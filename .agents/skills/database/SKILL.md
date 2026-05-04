---
name: database
description: "Work with the database layer: create tables, modify schema, generate migrations, and wire domain context for mutations. Use when changing database structure or writing functions that mutate data. Do not use for frontend collections or server functions — use the new-entity skill instead."
---

# Database Skill

Drizzle ORM + PostgreSQL. Two schemas: user data (`drizzle.config.ts`) and auth/Better Auth (`drizzle-auth.config.ts`).

## New Table Procedure

1. Define table in `packages/db/src/schema/` with UUIDv7 PK and `user_id` column. Read `references/denormalization-example.md` for the exact code pattern.
2. Add relations definition in the same schema file.
3. Update shared Zod schemas in `packages/domain/src/entities/<entity>.schema.ts` to include `userId`.
4. Suggest migration generation to the user — do not run it directly. Provide the command: `bun --cwd packages/db drizzle-kit generate --name <descriptive-name>`.
5. After user confirms migration generated, suggest `bun migrate` to apply.
6. Update domain functions to pass `ctx.userId` on insert.
7. Update shape handlers in `apps/web` to filter by `user_id`.

## ID Strategy

- **User-data PKs:** `uuid().default(sql`uuidv7()`).primaryKey()`
- **FKs to user-data tables:** `uuid('column_name').references(() => table.id, ...)`
- **FKs to auth tables (user_id):** `text('user_id').references(() => user.id, ...)` — stays `text` because Better Auth uses text IDs
- **Client-side ID generation:** `createId()` from `@repo/shared/utils` (UUID v7)
- **Server-side fallback:** Postgres generates via `uuidv7()` if no ID is passed

## User ID Denormalization

**Every table MUST have a `user_id` column with an index.** Including junction/join tables.

Electric SQL shapes cannot JOIN or subquery in where clauses. Without `user_id` directly on each table, filtering requires `WHERE id IN (...)` with thousands of IDs, causing HTTP 414 errors.

Read `references/denormalization-example.md` when creating any new table.

## Migration Workflow

**Never modify existing migration files.** Migrations run via `apps/migrator`.

### User schema changes

1. Modify table definitions in `packages/db/src/schema/`.
2. Suggest to the user: `bun --cwd packages/db drizzle-kit generate --name <descriptive-name>`
3. Suggest to the user: `bun migrate`
4. Commit both schema files and generated migration files.

### Auth schema changes

1. Update Better Auth config in `apps/web/src/server/auth.ts`.
2. Suggest to the user: `bun generate:auth-schema` then `bun migrate`.

## Domain Context

All domain mutation functions take an explicit context object (`ctx`) as their first parameter. Read `references/domain-context.md` for full type definitions, caller boundaries, and savepoint patterns.

**Quick reference:**

- **`TransactionContext`** — use for CRUD mutations that need deferred side effects via `ctx.afterCommit(() => enqueue...)`.
- **`DomainContext`** — use for read/write operations without deferred side effects (e.g., `syncSingleFeed`).
- **No context** — use for pure functions and standalone reads. Accept explicit params directly.

Callers (`apps/web` server functions, `apps/worker`) own the transaction boundary via `withTransaction()` or `createDomainContext()`. Domain functions never create their own top-level transactions.

## Electric SQL

Runs in automatic mode — manages publications, replica identity, and subscriptions automatically. No manual publication setup is needed.
