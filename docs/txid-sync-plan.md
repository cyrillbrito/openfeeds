# Plan: Transaction ID Sync for Optimistic Mutations

## Problem

When a user performs a mutation (e.g., removing a feed from a tag), the item flickers: it disappears, reappears briefly, then disappears again. Measured timing from the feed-tags removal:

| Time    | Feed Count | What happened                                      |
| ------- | ---------- | -------------------------------------------------- |
| 0ms     | 7          | Initial state                                      |
| +3800ms | 6          | Local optimistic delete                            |
| +3970ms | **7**      | Electric sync pushes back old server state         |
| +4100ms | 6          | Server confirms delete, Electric syncs final state |

The item goes **7 -> 6 -> 7 -> 6**.

## Root Cause

TanStack DB maintains an optimistic overlay (`optimisticDeletes`/`optimisticUpserts`) that hides locally-mutated items from queries while a transaction is in `pending` or `persisting` state. When the `onDelete`/`onInsert`/`onUpdate` handler resolves, the transaction moves to `completed`, and the optimistic overlay is cleared.

**Currently, all collection handlers return `void`:**

```ts
onDelete: async ({ transaction }) => {
  const ids = transaction.mutations.map((mutation) => mutation.key as string);
  await $$deleteFeedTags({ data: ids });
  // returns void — transaction completes immediately
};
```

Without a return value, TanStack DB has no way to know when the Electric sync stream has confirmed the mutation. The sequence becomes:

1. `collection.delete()` -> optimistic overlay hides item
2. Handler fires server function, awaits response
3. Server function returns -> transaction completes -> **optimistic overlay cleared**
4. `syncedData` still has the old row (Electric hasn't delivered the delete yet) -> **item reappears**
5. Electric sync stream delivers the delete -> item removed from `syncedData` -> item disappears for good

## The Fix: Return `{ txid }` from Handlers

TanStack DB's `electricCollectionOptions` supports a `MatchingStrategy` return type:

```ts
type MatchingStrategy = { txid: Txid | Array<Txid>; timeout?: number } | void;
```

When the handler returns `{ txid }`, TanStack DB calls `awaitTxId()` which **blocks the transaction from completing** until the Electric sync stream delivers that specific PostgreSQL transaction ID. The optimistic overlay stays active the entire time — no flicker.

From the [TanStack DB docs](https://tanstack.com/db/latest/docs/collections/electric-collection):

```ts
// Recommended pattern from docs
onDelete: async ({ transaction }) => {
  const mutation = transaction.mutations[0];
  const result = await api.todos.delete({ id: mutation.original.id });
  return { txid: result.txid }; // keeps optimistic overlay until sync confirms
};
```

### How to get `txid` from PostgreSQL

The `txid` must be obtained **inside the same database transaction** as the mutation using `pg_current_xact_id()`. From the docs:

```ts
// CORRECT: txid inside the transaction
async function createTodo(data) {
  return await sql.begin(async (tx) => {
    const [todo] = await tx`INSERT INTO todos ...`;
    return { todo, txid: await getTxId(tx) };
  });
}

// WRONG: txid from a separate transaction
async function createTodo(data) {
  const txid = await getTxId(sql); // different transaction!
  await sql.begin(async (tx) => {
    await tx`INSERT INTO todos ...`;
  });
  return { txid }; // won't match!
}
```

For Drizzle ORM specifically:

```ts
async function getTxId(tx: Transaction): Promise<Txid> {
  const result = await tx.execute(sql`SELECT pg_current_xact_id()::xid::text as txid`);
  const txid = result.rows[0]?.txid;
  if (txid === undefined) {
    throw new Error('Failed to get transaction ID');
  }
  // The ::xid cast strips off the epoch, giving the raw 32-bit value
  // that matches what PostgreSQL sends in logical replication streams
  return parseInt(txid as string, 10);
}
```

---

## Design Decisions

### 1. `txid` is the caller's responsibility, not the domain's

The `txid` is a transport/sync concern — it exists to bridge TanStack DB's optimistic layer with Electric SQL's sync stream. Domain functions should not know about it. They are pure business logic.

**The server function layer owns the transaction and the `txid`.** It wraps the domain call in `db.transaction()`, extracts the `txid` via `getTxId(tx)`, passes `tx` to the domain function, and returns `{ txid }` to the collection handler.

This means:

- Domain functions **never** return `txid` — their return types don't change
- Domain functions **never** call `getTxId` — they don't import it
- Only the server functions (`.server.ts`) and the `getTxId` helper know about `txid`

### 2. Domain functions accept a connection parameter with default

Every mutation function gains a `conn` parameter (last argument), typed as `Db | Transaction`, defaulting to the module-level `db`. Drizzle's `Transaction` extends `PgDatabase` (same base as `Db`), so both have `.insert()`, `.update()`, `.delete()`, `.select()`, `.query`.

```ts
// Before
export async function deleteFeedTags(ids: string[], userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    // ...
  });
}

// After
export async function deleteFeedTags(ids: string[], userId: string, conn: Db | Transaction = db): Promise<void> {
  // Uses conn directly — no intermediate variable needed
  await conn.delete(feedTags).where(...);
}
```

This enables composition — multiple domain functions can run inside a shared transaction:

```ts
await db.transaction(async (tx) => {
  await createFeeds(feedData, userId, tx);
  await createTags(tagData, userId, tx);
  await createFeedTags(feedTagData, userId, tx);
});
```

When a `tx` is passed in, the function must NOT create a new `db.transaction()` (that would be a separate Postgres transaction). Functions that currently use `db.transaction()` need refactoring to use `conn.transaction()` instead (which creates a savepoint when `conn` is already a transaction, or a real transaction when `conn` is `db`).

### 3. Server functions own the transaction boundary

The server function wraps everything in a transaction, gets the `txid`, and passes `tx` down:

```ts
// Before
export const $$deleteFeedTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(({ context, data: ids }) => {
    return feedTagsDomain.deleteFeedTags(ids, context.user.id);
  });

// After
export const $$deleteFeedTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await db.transaction(async (tx) => {
      await feedTagsDomain.deleteFeedTags(ids, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });
```

For server functions whose domain functions return data that the caller needs (e.g., `createArticle` returns the article for the collection handler to write back extracted content):

```ts
export const $$createArticle = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    return await db.transaction(async (tx) => {
      const article = await articlesDomain.createArticle(data, context.user.id, tx);
      return { txid: await getTxId(tx), article };
    });
  });
```

### 4. Collection handlers return `{ txid }`

```ts
// Before
onDelete: collectionErrorHandler('feedTags.onDelete', async ({ transaction }) => {
  const ids = transaction.mutations.map((mutation) => mutation.key as string);
  await $$deleteFeedTags({ data: ids });
}),

// After
onDelete: collectionErrorHandler('feedTags.onDelete', async ({ transaction }) => {
  const ids = transaction.mutations.map((mutation) => mutation.key as string);
  const { txid } = await $$deleteFeedTags({ data: ids });
  return { txid };
}),
```

### 5. `getTxId` lives in `@repo/db`

A shared helper that only the server function layer imports:

```ts
// packages/db/src/txid.ts
import { sql } from 'drizzle-orm';
import type { Transaction } from './config';

export async function getTxId(tx: Transaction): Promise<number> {
  const result = await tx.execute(sql`SELECT pg_current_xact_id()::xid::text as txid`);
  const txid = result.rows[0]?.txid;
  if (txid === undefined) {
    throw new Error('Failed to get transaction ID');
  }
  return parseInt(txid as string, 10);
}
```

### 6. Nested transactions use Drizzle savepoints

Drizzle's `tx.transaction()` creates a PostgreSQL savepoint (not a new transaction). `pg_current_xact_id()` returns the same value at any nesting level. So composite server functions can call `getTxId(tx)` once at the top level, pass `tx` to multiple domain functions, and return a single `txid`.

### 7. Side effects (analytics, queue jobs) stay outside transactions

Some domain functions do non-DB work: PostHog analytics, BullMQ job enqueuing. These should NOT be inside the database transaction. Pattern:

```ts
export async function createFeeds(data, userId, conn: Db | Transaction = db) {
  const rows = await conn.insert(feeds).values(...).returning();
  // Side effects after the DB write
  posthog.capture(...);
  await enqueueFeedSync(...);
  return rows;
}
```

When called inside a caller's transaction, the side effects fire after the domain function returns but before the outer transaction commits. This is acceptable — analytics and job enqueuing are best-effort and idempotent.

---

## Scope of Changes

### Layer 1: `packages/db` (1 new file)

- Add `src/txid.ts` with `getTxId` helper
- Export from `src/index.ts`

### Layer 2: `packages/domain` (16 functions across 7 files)

Add optional `conn?: Db | Transaction` parameter. No return type changes. No `txid` awareness.

Functions that already use `db.transaction()` need refactoring to use `conn ?? db` and handle both standalone and composed modes.

| File             | Function            | Currently has `db.transaction()`? | Change needed                             |
| ---------------- | ------------------- | --------------------------------- | ----------------------------------------- |
| `feed-tag.ts`    | `createFeedTags`    | Yes                               | Add `conn = db`, use `conn.transaction()` |
| `feed-tag.ts`    | `deleteFeedTags`    | Yes                               | Same                                      |
| `tag.ts`         | `createTags`        | No                                | Add `conn = db`, use `conn` directly      |
| `tag.ts`         | `updateTags`        | Yes                               | Add `conn = db`, use `conn.transaction()` |
| `tag.ts`         | `deleteTags`        | No                                | Add `conn = db`, use `conn` directly      |
| `feed.ts`        | `createFeeds`       | No                                | Add `conn = db`, use `conn` directly      |
| `feed.ts`        | `updateFeeds`       | Yes                               | Add `conn = db`, use `conn.transaction()` |
| `feed.ts`        | `deleteFeeds`       | No                                | Add `conn = db`, use `conn` directly      |
| `settings.ts`    | `updateSettings`    | No                                | Add `conn = db`, use `conn` directly      |
| `article.ts`     | `createArticle`     | No                                | Add `conn = db`, use `conn` directly      |
| `article.ts`     | `updateArticles`    | Yes                               | Add `conn = db`, use `conn.transaction()` |
| `filter-rule.ts` | `createFilterRules` | No                                | Add `conn = db`, use `conn` directly      |
| `filter-rule.ts` | `updateFilterRules` | Yes                               | Add `conn = db`, use `conn.transaction()` |
| `filter-rule.ts` | `deleteFilterRules` | No                                | Add `conn = db`, use `conn` directly      |
| `article-tag.ts` | `createArticleTags` | No                                | Add `conn = db`, use `conn` directly      |
| `article-tag.ts` | `deleteArticleTags` | No                                | Add `conn = db`, use `conn` directly      |

### Layer 3: `apps/web/src/entities/*.server.ts` (16 server functions)

Each server function wraps its domain call in `db.transaction()`, calls `getTxId(tx)`, passes `tx` to the domain function, and returns `{ txid }` (plus any data the collection handler needs).

### Layer 4: `apps/web/src/lib/collection-errors.ts`

Verify the `collectionErrorHandler` wrapper passes through the return value from the wrapped function. If it swallows the return, update it.

### Layer 5: `apps/web/src/entities/*.ts` (16 collection handlers)

Update `onInsert`/`onUpdate`/`onDelete` to return `{ txid }` from the server function result.

---

## Implementation Order

1. `packages/db` — add `getTxId` helper
2. `packages/domain` — add `conn` parameter to all 16 functions (entity-by-entity)
3. `apps/web/src/entities/*.server.ts` — wrap in transactions, return `{ txid }`
4. `apps/web/src/lib/collection-errors.ts` — ensure return passthrough
5. `apps/web/src/entities/*.ts` — return `{ txid }` from handlers
6. Test: verify the flicker is gone on the tags feed removal
7. Remove debug console.logs added during investigation

## Future: Composite Function Refactoring

Once domain functions accept `conn`, composite functions like `followFeedsWithTags` and `importOpmlFeeds` can be refactored to call entity-level functions instead of duplicating insert logic. This isn't required for the txid fix but is a natural follow-up — it eliminates the current duplication where composite functions re-implement tag propagation, limit checks, and conflict handling that entity functions already handle.

```ts
// follow-feeds.ts — future
export async function followFeedsWithTags(data, userId, conn: Db | Transaction = db) {
  const feeds = await createFeeds(feedData, userId, conn);
  const tags = await createTags(tagData, userId, conn);
  await createFeedTags(feedTagData, userId, conn);
}

// Server function owns the transaction + txid
export const $$followFeedsWithTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    return await db.transaction(async (tx) => {
      await followFeedsWithTags(data, context.user.id, tx);
      return { txid: await getTxId(tx) };
    });
  });
```
