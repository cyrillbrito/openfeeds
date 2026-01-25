# Worker - Background Job Processor

Runs BullMQ Worker instances to process jobs. Calls `@repo/domain` business logic.

## Commands

```bash
bun dev          # Dev with hot reload
bun start        # Start prod
bun check-types  # TypeScript check
bun benchmark    # Run performance benchmark
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
import { getUserDb } from '@repo/db';
import { getRedisConnection, QUEUE_NAMES, syncSingleFeed } from '@repo/domain';
import { Worker } from 'bullmq';

export function createSingleFeedSyncWorker() {
  return new Worker(
    QUEUE_NAMES.SINGLE_FEED_SYNC,
    async (job) => {
      const db = getUserDb(job.data.userId);
      await syncSingleFeed(db, job.data.feedId);
    },
    { connection: getRedisConnection(), concurrency: 2 },
  );
}
```

## Deployment

- Run multiple worker instances for horizontal scaling
- Workers compete for jobs via Redis
- Runs separately from API server (no HTTP port needed)
- Must have access to same Redis and SQLite as server

## Best Practices

- **Only create Worker instances** - Never enqueue jobs
- **Call domain functions** - Never duplicate business logic
- Setup graceful shutdown (SIGTERM/SIGINT)

## Benchmarking

Measure worker throughput and latency with synthetic feeds.

**Prerequisites:** Redis running, workers running (`bun dev`)

```bash
bun benchmark                          # 50 feeds, 30 articles each (default)
bun benchmark --feeds=100 --articles=50 # Custom scale
bun benchmark --delay=50               # Simulate network latency (ms per request)
bun benchmark --json                   # JSON output
```

**Output:** Jobs/sec, p50/p95/p99 latency, error rate. Results saved to `benchmark-results/`.
