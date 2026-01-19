# Migrator - Database Migration Runner

One-shot service that runs all database migrations and exits.

## Commands

```bash
bun start        # Run all migrations
bun check-types  # TypeScript check
```

## Architecture

Self-contained app with its own environment config. Does not depend on `@repo/domain`.

Creates its own `DbProvider` instance and runs:

1. Auth database migrations
2. User-template database migrations
3. All existing user database migrations

Exits 0 on success, 1 on failure.

## Docker Compose

```yaml
services:
  migrator:
    build:
      dockerfile: Dockerfile.migrations
    restart: 'no'

  web:
    depends_on:
      migrator:
        condition: service_completed_successfully
```

## Environment Variables

- `DB_PATH` - SQLite database directory path
