# Domain Context

All domain functions that mutate data receive an explicit context object as their first parameter. This replaces raw `conn`/`userId` parameter passing and makes every function's dependencies visible in its signature.

## Types

```ts
interface DomainContext {
  userId: string;
  conn: Db | Transaction;
}

interface TransactionContext extends DomainContext {
  conn: Transaction;
  afterCommit: (effect: () => Promise<unknown>) => void;
}
```

- **`DomainContext`** — for functions that read/write but don't need deferred side effects (e.g., `syncSingleFeed`, `updateFeedMetadata`)
- **`TransactionContext`** — for functions that write and enqueue jobs. `afterCommit` defers effects until the transaction commits, preventing workers from processing data that doesn't exist yet.

Functions that don't need userId or a connection (pure, standalone reads) take explicit params directly — no context.

## Boundaries

**Server functions** (`apps/web/src/entities/*.functions.ts`) own the transaction:

```ts
return await withTransaction(db, context.user.id, async (ctx) => {
  await domain.createFeeds(ctx, data);
  return { txid: await getTxId(ctx.conn) };
});
```

**Workers** (`apps/worker/src/workers.ts`) use `createDomainContext` for non-transactional work and `withTransaction` for transactional:

```ts
const ctx = createDomainContext(db, userId);
await syncSingleFeed(ctx, feedId);
```

**Queue functions** are plain — no context awareness. Callers defer via `ctx.afterCommit(() => enqueueFeedSync(...))`.

## Savepoints

When a domain function needs per-item error isolation inside an existing transaction (e.g., OPML import processing multiple feeds), use `ctx.conn.transaction()` which Drizzle maps to PostgreSQL `SAVEPOINT`/`RELEASE`. A failed savepoint rolls back only that item without poisoning the outer transaction.
