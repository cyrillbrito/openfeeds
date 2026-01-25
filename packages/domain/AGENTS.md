# Domain Package - Business Logic

All business logic for OpenFeeds. Shared by web (server functions), server (auth/jobs), and worker (job processing).

## Commands

```bash
bun check-types
```

## Architecture

**Owns:**

- Business logic (feeds, articles, tags, settings, RSS sync, archive, import)
- Queue instances and enqueueing (BullMQ Queue, not Worker)
- Infrastructure (config, logger, errors)

**Does NOT own:**

- BullMQ Worker instances → `apps/worker`
- HTTP routes → `apps/server`

## Key Modules

**Business Logic:** feeds, articles, tags, settings, filter-rules, archive, import, rss-fetch

**Infrastructure:** queues, queue-config, config, logger, errors

## Queue Architecture

**Exports:**

- Queue instances: `feedSyncOrchestratorQueue`, `singleFeedSyncQueue`, `feedDetailQueue`, `autoArchiveQueue`
- Enqueue functions: `enqueueFeedSync()`, `enqueueFeedDetail()`, `initializeScheduledJobs()`
- Config: `QUEUE_NAMES`, `redisConnection`

**Scheduled Jobs (`initializeScheduledJobs()`):**

- Feed sync orchestrator: `* * * * *` (every minute)
- Auto archive: `0 0 * * *` (daily at midnight)

**Pattern:**

1. Server enqueues via `enqueueFeedSync()`, `enqueueFeedDetail()`
2. Worker creates Worker instances, calls domain business logic
3. Both connect to same Redis queues

## Guidelines

- Pure business logic only (no HTTP, no Workers)
- Owns Queue instances and enqueueing, NOT Worker instances
- Throw domain errors: `NotFoundError`, `ConflictError`, `UnauthorizedError`, etc.
- Import utilities from `@repo/shared/utils`
