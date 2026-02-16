# Worker - Background Job Processor

BullMQ Worker instances that process jobs by calling `@repo/domain` business logic.

## Commands

```bash
bun dev          # Dev with hot reload
bun start        # Start prod
bun check-types  # TypeScript check
bun benchmark    # Performance benchmark
```

## Architecture

- `src/index.ts` — entry point, creates workers, graceful shutdown
- `src/workers.ts` — worker factory functions

**Responsibilities:**

- Create Worker instances
- Process jobs by calling `@repo/domain` functions
- Graceful shutdown

**Does NOT:** Enqueue jobs (that's `@repo/domain`), contain business logic, or run HTTP.

## Workers

- **Feed Sync Orchestrator** — `enqueueStaleFeeds()`, every minute
- **Single Feed Sync** — `syncSingleFeed()` per feed
- **Feed Details** — `updateFeedMetadata()` per feed
- **Auto Archive** — `autoArchiveForAllUsers()`, daily midnight

## Environment Variables

Configured in `src/env.ts`. All `WORKER_CONCURRENCY_*` vars default to 1-2 (conservative for small VMs).

## Benchmarking

```bash
bun benchmark                             # 50 feeds, 30 articles each
bun benchmark --feeds=100 --articles=50   # Custom scale
bun benchmark --delay=50                  # Simulate network latency
bun benchmark --json                      # JSON output
```

Requires Redis + workers running. Results saved to `benchmark-results/`.
