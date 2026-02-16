# Domain Package - Business Logic

All business logic for OpenFeeds. Shared by web (server functions) and worker (job processing).

## Commands

```bash
bun check-types
```

## Architecture

**Owns:**

- Business logic
- Queue instances + enqueueing (BullMQ Queue)
- Infrastructure (config, logger, errors)

**Does NOT own:** BullMQ Worker instances (`apps/worker`), HTTP routes (`apps/web`)

## Client/Server Split

Each entity in `src/entities/` is split into two files:

- **`.schema.ts`** — Zod schemas, types, pure functions. NO `@repo/db` imports. Client-safe.
- **`.ts`** — CRUD functions using `@repo/db`. Re-exports from schema via `export * from './X.schema'`.

**Two entry points:**

- `@repo/domain/client` — schemas, types, pure functions (for client code)
- `@repo/domain` — full server exports including CRUD (for server code)

## Queues

Domain owns Queue instances and enqueue functions. Worker creates Worker instances.

- `enqueueFeedSync()`, `enqueueFeedDetail()`, `initializeScheduledJobs()`
- Config: `QUEUE_NAMES`, `redisConnection`
- Scheduled: feed sync orchestrator (every minute), auto archive (daily midnight)

## Error Handling

Domain errors are transport-agnostic. See [docs/error-handling.md](../../docs/error-handling.md).

- Throw domain errors directly — don't catch/wrap at domain level
- Error messages must be user-safe (they reach the client as-is)
- Never add HTTP concepts (status codes) to domain errors
- Error classes: `NotFoundError`, `ConflictError`, `UnauthorizedError`, etc.

## Guidelines

- Pure business logic only (no HTTP, no Workers)
- Import utilities from `@repo/shared/utils`
