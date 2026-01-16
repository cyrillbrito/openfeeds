# Worker - Background Job Processor

Runs BullMQ Worker instances to process jobs. Calls `@repo/domain` business logic.

## Commands

```bash
bun dev          # Dev with hot reload
bun start        # Start prod
bun check-types  # TypeScript check
```

## Architecture

**Responsibilities:**

- Create BullMQ Worker instances
- Process jobs from Redis queues
- Call `@repo/domain` business logic
- Initialize scheduled jobs via `initializeScheduledJobs()`

**Does NOT:**

- Enqueue jobs → `@repo/domain`
- Contain business logic → `@repo/domain`
- Run HTTP server → `apps/server`

## Key Files

- `src/index.ts` - Entry point, creates workers, graceful shutdown
- `src/workers.ts` - Worker factory functions

## Workers

- `Feed Sync Orchestrator` - Calls `syncOldestFeeds()`, runs every minute
- `Single Feed Sync` - Calls `syncSingleFeed()` for individual feeds
- `Feed Details` - Calls `updateFeedMetadata()` for feed metadata
- `Auto Archive` - Calls `autoArchiveArticles()`, runs daily at midnight

## Worker Pattern

```typescript
import { dbProvider, QUEUE_NAMES, redisConnection } from '@repo/domain';
import { Worker } from 'bullmq';

export function createSingleFeedSyncWorker() {
  return new Worker(
    QUEUE_NAMES.SINGLE_FEED_SYNC,
    async (job) => {
      const db = dbProvider.userDb(job.data.userId);
      await syncSingleFeed(db, job.data.feedId);
    },
    { connection: redisConnection, concurrency: 2 },
  );
}
```

## Environment Variables

Inherited from `@repo/domain`:

- `DB_PATH` - SQLite database path
- `REDIS_HOST`, `REDIS_PORT` - Redis connection
- `POSTHOG_PUBLIC_KEY` - Analytics (optional)

## Deployment

- Run multiple worker instances for horizontal scaling
- Workers compete for jobs via Redis
- Runs separately from API server (no HTTP port needed)
- Must have access to same Redis and SQLite as server

## Best Practices

- **Only create Worker instances** - Never enqueue jobs
- **Call domain functions** - Never duplicate business logic
- Setup graceful shutdown (SIGTERM/SIGINT)
