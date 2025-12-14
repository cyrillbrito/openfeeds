# API Server - Elysia HTTP Server

## Commands

```bash
bun dev          # Dev with hot reload
bun build        # Production build
bun start        # Start prod
bun check-types  # TypeScript check
```

## Architecture

**Responsibilities:**
- HTTP API endpoints
- Authentication (Better Auth)
- Job enqueueing via `@repo/domain`
- Bull Board dashboard at `/admin/queues` (monitoring only)

**Does NOT:**
- Create Worker instances → `apps/worker`
- Contain business logic → `@repo/domain`

## Key Files

- `src/index.ts` - Server entry, runs migrations, Bull Board setup
- `src/setup-elysia.ts` - App config + middleware
- `src/bull-board.ts` - Queue monitoring dashboard
- `src/auth-plugin.ts` - Auth middleware (provides db, user, session)
- `src/error-handler-plugin.ts` - Global error handling
- `src/apps/` - API route handlers

## Route Pattern

```typescript
import { createFeed, getAllFeeds } from '@repo/domain';

const app = new Elysia({ prefix: '/feeds' })
  .use(authPlugin)  // Provides { db, user, session }
  .get('/', async ({ db }) => getAllFeeds(db), {
    response: FeedSchema.array(),
  });
```

## Background Jobs

Enqueue via `@repo/domain`:

```typescript
import { enqueueFeedSync, enqueueFeedDetail } from '@repo/domain';

await enqueueFeedSync(userId, feedId);
await enqueueFeedDetail(userId, feedId);
```

## Environment Variables

**Required:**
- `DB_PATH` - SQLite database path
- `BETTER_AUTH_SECRET` - Auth secret key
- `CLIENT_DOMAIN` - Client domain for CORS

**Optional:**
- `POSTHOG_PUBLIC_KEY` - PostHog analytics
- `SIMPLE_AUTH` - Simple auth mode (dev only)
- `REDIS_HOST`, `REDIS_PORT` - Redis connection

## Best Practices

- **Use `@repo/domain` for all business logic** - Never duplicate
- **Only enqueue jobs** - Never create Worker instances
- Middleware order: Error handler → Auth → Routes
- OpenAPI documentation enabled
