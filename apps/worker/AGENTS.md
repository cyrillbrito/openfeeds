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
- Run HTTP server → `apps/web`

## Key Files

- `src/index.ts` - Entry point, creates workers, graceful shutdown
- `src/workers.ts` - Worker factory functions

## Workers

- `Feed Sync Orchestrator` - Calls `syncOldestFeeds()`, runs every minute
- `Single Feed Sync` - Calls `syncSingleFeed()` for individual feeds
- `Feed Details` - Calls `updateFeedMetadata()` for feed metadata
- `Auto Archive` - Calls `autoArchiveArticles()`, runs daily at midnight

## Environment Variables

Configured in `src/env.ts` using t3-env:

| Variable                          | Default | Description                       |
| --------------------------------- | ------- | --------------------------------- |
| `WORKER_CONCURRENCY_ORCHESTRATOR` | 1       | Concurrency for orchestrator jobs |
| `WORKER_CONCURRENCY_FEED_SYNC`    | 2       | Concurrency for feed sync jobs    |
| `WORKER_CONCURRENCY_FEED_DETAILS` | 1       | Concurrency for feed details jobs |
| `WORKER_CONCURRENCY_AUTO_ARCHIVE` | 1       | Concurrency for auto-archive jobs |

Defaults are conservative for small VMs. Increase for higher throughput on larger machines.

## Worker Pattern

```typescript
import { db } from '@repo/db';
import { QUEUE_NAMES, redisConnection, syncSingleFeed } from '@repo/domain';
import { Worker } from 'bullmq';
import { env } from './env';

export function createSingleFeedSyncWorker() {
  return new Worker(
    QUEUE_NAMES.SINGLE_FEED_SYNC,
    async (job) => {
      await syncSingleFeed(job.data.userId, job.data.feedId);
    },
    { connection: redisConnection, concurrency: env.WORKER_CONCURRENCY_FEED_SYNC },
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
