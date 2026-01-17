# API Server - Elysia (DEPRECATED)

> **DEPRECATED**: This server is being phased out. Use TanStack Start server functions in `apps/web` for all new endpoints.
>
> Currently still handles: Better Auth (`/api/auth/*`), Bull Board dashboard.
>
> **Do NOT add new API routes here.** Add server functions in `apps/web/src/entities/` instead.

## Commands

```bash
bun dev          # Dev with hot reload
bun build        # Production build
bun start        # Start prod
bun check-types  # TypeScript check
```

## Responsibilities

**What this server does:**

- Better Auth API (`/api/auth/*`)
- Background job enqueueing
- Bull Board dashboard at `/admin/queues`

**What it does NOT do:**

- Data CRUD operations → handled by `apps/web` server functions
- Worker job processing → `apps/worker`
- Business logic → `@repo/domain`

## Key Files

- `src/index.ts` - Server entry, migrations, Bull Board
- `src/setup-elysia.ts` - App config + middleware
- `src/bull-board.ts` - Queue monitoring
- `src/auth-plugin.ts` - Auth middleware
- `src/apps/` - Route handlers (minimal now)

## Background Jobs

Enqueue via `@repo/domain`:

```typescript
import { enqueueFeedDetail, enqueueFeedSync } from '@repo/domain';

await enqueueFeedSync(userId, feedId);
await enqueueFeedDetail(userId, feedId);
```

## Environment Variables

**Required:**

- `DB_PATH` - SQLite database path
- `BETTER_AUTH_SECRET` - Auth secret key
- `CLIENT_DOMAIN` - Client domain for CORS

**Optional:**

- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `POSTHOG_PUBLIC_KEY` - Analytics
- `SIMPLE_AUTH` - Dev auth mode

## Notes

- Use `@repo/domain` for all business logic
- Only enqueue jobs, never create Workers
- OpenAPI documentation enabled
