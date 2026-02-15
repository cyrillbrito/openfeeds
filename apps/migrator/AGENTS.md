# Migrator - Database Migration Runner

One-shot service that runs all database migrations and exits.

## Commands

```bash
bun start        # Run all migrations
bun check-types  # TypeScript check
```

## Architecture

Imports `runMigrations` from `@repo/db` which uses the `db` instance directly. Does not depend on `@repo/domain`.

Runs all database migrations and exits 0 on success, 1 on failure.

## Environment Variables

Database connection is configured via `DATABASE_URL` (owned by `@repo/db`).
