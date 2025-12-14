# Domain Logic & Worker Split

**Date:** 2025-11-05  
**Status:** Proposed

## Why

Currently, API server and BullMQ workers run from a single entry point (`apps/server/src/index.ts`). This prevents:

- **Independent scaling** - Can't run more workers than API servers
- **Separate deployment** - Worker changes require API redeployment
- **Process isolation** - Worker crashes affect API, vice versa
- **Domain reuse** - Business logic trapped in server app

## Current State

```
apps/server/src/
  ├── domain/          # Business logic (rss-sync, archive, feeds, etc.)
  ├── apps/            # HTTP route handlers
  ├── queue/           # Workers + scheduler
  ├── utils/           # Logger, common utilities
  └── index.ts         # Runs API + workers together
```

## Target State

```
packages/
  └── domain/          # Business logic + shared utilities
      ├── rss-sync.ts
      ├── archive.ts
      ├── feeds.ts
      ├── logger.ts
      ├── db-provider.ts
      └── environment.ts

apps/
  ├── server/          # Pure HTTP API
  │   ├── apps/        # Route handlers
  │   └── index.ts     # Elysia + Auth + Bull Board
  └── worker/          # Pure background jobs
      ├── workers.ts
      └── index.ts     # BullMQ workers + scheduler
```

## Work Breakdown

### 1. Create `packages/domain`

- Move `apps/server/src/domain/*` → `packages/domain/src/`
- Move logger, db-provider, environment to `packages/domain/src/`
- Add package.json with dependencies (Drizzle, PostHog, Redis, etc.)

### 2. Create `apps/worker`

- New entry point that runs only workers + scheduler
- Import worker definitions from current `apps/server/src/queue/workers.ts`
- Move workers.ts to `apps/worker/src/`
- Keep queue config shareable (Redis connection, queue names)

### 3. Refactor `apps/server`

- Remove domain/, queue/workers.ts
- Keep queue/scheduler.ts for Bull Board dashboard + job enqueueing
- Update imports to use `@repo/domain`
- Keep route handlers that enqueue jobs

### 4. Update dependencies

- Both apps depend on `packages/domain`
- Move BullMQ to domain (or shared config package)
- Ensure Redis connection config is shareable

## Shared Concerns

**Logger** - Move to domain, works same for API + workers (already has `source: 'api' | 'worker'`)

**Error Handling** - Domain functions throw, apps handle (already working this way)

**Environment** - Move to domain, both apps validate same env vars

**Database** - DbProvider already singleton-safe, move to domain

## Migration Steps

1. Create `packages/domain` with tsconfig + package.json
2. Move domain logic + utilities
3. Create `apps/worker` with worker entry point
4. Update `apps/server` imports to `@repo/domain`
5. Update turbo.json for new app
6. Test both entry points independently
7. Update Docker/deployment configs

## Testing

- API server runs without workers: ✓
- Worker runs without API server: ✓
- Both can run simultaneously: ✓
- E2E tests unchanged (use dev mode with both): ✓
