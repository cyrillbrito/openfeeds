# Database Migrations Architecture

## Problem

Migrations ran at TanStack Start server startup. In production, this failed because Nitro bundles JS but not the raw SQL migration files - they don't exist in the bundled output.

## Solution

Dedicated migrator service (`apps/migrator`) that:

1. Runs all migrations (auth, user-template, all users)
2. Exits with code 0 (success) or 1 (failure)
3. Other services wait for it via `depends_on: service_completed_successfully`

## Why Not Alternatives?

**Nitro serverAssets**: Would require refactoring to use Nitro's storage API instead of filesystem. Drizzle expects filesystem paths.

**Entrypoint script**: Web image would need migration files (larger). Every replica runs migration check. Mixes concerns.

## Deployment Flow

```
docker compose up
  → migrator service runs
  → exits 0
  → web/worker services start
```

If migrations fail, dependent services never start.

## Files

- `apps/migrator/` - Migration runner service
- `Dockerfile.migrations` - Includes `packages/db` with SQL files
- `docker-compose.yml` - Orchestrates with `depends_on`
