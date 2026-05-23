# Worker - Background Job Processor

BullMQ Worker instances that process jobs by calling `@repo/domain` business logic.

## Commands

```bash
bun dev          # Dev with hot reload
bun start        # Start prod
```

## Architecture

- `src/index.ts` — entry point, creates workers, graceful shutdown
- `src/workers.ts` — worker factory functions

**Responsibilities:**

- Create Worker instances
- Process jobs by calling `@repo/domain` functions
- Graceful shutdown

**Does NOT:** Enqueue jobs (that's `@repo/domain`), contain business logic, or run HTTP.

Workers use `createDomainContext(db, userId)` for non-transactional domain calls and `withTransaction(db, userId, fn)` for transactional ones. See [docs/domain-context.md](../../docs/domain-context.md).

## Workers

- **Feed Sync Orchestrator** — `enqueueStaleFeeds()`, every minute
- **Single Feed Sync** — `syncSingleFeed()` per feed
- **Feed Details** — `updateFeedMetadata()` per feed
- **Auto Archive** — `autoArchiveForAllUsers()`, daily midnight

## Environment Variables

Configured in `src/env.ts`. All `WORKER_CONCURRENCY_*` vars default to 1-2 (conservative for small VMs).
