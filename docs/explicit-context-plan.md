# Explicit Domain Context — Implementation Plan

Replace `AsyncLocalStorage`-based implicit context with an explicit `DomainContext` object passed as a parameter.

## Why

- Function signatures become honest — `ctx` param = needs context, no `ctx` = pure
- Compile-time errors instead of runtime `throw` when context is missing
- Testable without `AsyncLocalStorage` ceremony — just pass a mock ctx
- Eliminates the inconsistency problem (settings.ts has 3 different patterns today)
- Matches industry standard (tRPC, Hono, Cal.com, Documenso all use explicit context)

## Context Types

```ts
// packages/domain/src/domain-context.ts

export interface DomainContext {
  userId: string;
  conn: Db | Transaction;
}

export interface TransactionContext extends DomainContext {
  conn: Transaction;
  afterCommit: (effect: () => Promise<unknown>) => void;
}
```

**Rule:** `afterCommit` only exists on `TransactionContext`. Functions that
write to DB and enqueue jobs must require `TransactionContext`. Functions
that only read/write without side effects can accept `DomainContext`.
Functions that don't need userId/conn at all take neither — they're pure.

## Context Creation

```ts
// packages/domain/src/domain-context.ts

export function createDomainContext(conn: Db, userId: string): DomainContext {
  return { userId, conn };
}

export async function withTransaction<T>(
  conn: Db,
  userId: string,
  fn: (ctx: TransactionContext) => Promise<T>,
): Promise<T> {
  const pendingEffects: Array<() => Promise<unknown>> = [];

  const result = await conn.transaction(async (tx) => {
    const ctx: TransactionContext = {
      userId,
      conn: tx,
      afterCommit: (effect) => {
        pendingEffects.push(effect);
      },
    };
    return fn(ctx);
  });

  // Transaction committed — flush deferred effects
  await Promise.all(pendingEffects.map((effect) => effect()));

  return result;
}
```

## Function Classification

Every domain function falls into one of three categories. The category
determines the signature. No exceptions, no mixed patterns.

### 1. `TransactionContext` — writes + side effects (jobs)

These functions insert/update/delete AND enqueue jobs that depend on the
written data. They MUST run inside a transaction so jobs don't fire before
data is committed.

| Function                | File                      |
| ----------------------- | ------------------------- |
| `createFeeds`           | `entities/feed.ts`        |
| `createArticles`        | `entities/article.ts`     |
| `createTags`            | `entities/tag.ts`         |
| `createArticleTags`     | `entities/article-tag.ts` |
| `createFeedTags`        | `entities/feed-tag.ts`    |
| `createFilterRules`     | `entities/filter-rule.ts` |
| `updateFeeds`           | `entities/feed.ts`        |
| `updateArticles`        | `entities/article.ts`     |
| `updateTags`            | `entities/tag.ts`         |
| `updateFilterRules`     | `entities/filter-rule.ts` |
| `updateSettings`        | `entities/settings.ts`    |
| `deleteFeeds`           | `entities/feed.ts`        |
| `deleteArticleTags`     | `entities/article-tag.ts` |
| `deleteFeedTags`        | `entities/feed-tag.ts`    |
| `deleteTags`            | `entities/tag.ts`         |
| `deleteFilterRules`     | `entities/filter-rule.ts` |
| `followFeedsWithTags`   | `follow-feeds.ts`         |
| `importOpmlFeeds`       | `import.ts`               |
| `markFeedAsFailing`     | `feed-sync.ts`            |
| `recordFeedSyncFailure` | `feed-sync.ts`            |

Note: `deleteFeeds`, `updateFeeds`, etc. don't currently enqueue jobs, but
they still write to DB and are always called from a transaction context in
handlers. Keeping them as `TransactionContext` is consistent and safe — a
`TransactionContext` can always be passed where `DomainContext` is expected
since it extends it.

### 2. `DomainContext` — reads/writes, no job side effects

These functions need `userId` and `conn` but don't enqueue jobs. They
can run inside or outside a transaction (a `TransactionContext` satisfies
`DomainContext`).

| Function                 | File              |
| ------------------------ | ----------------- |
| `syncSingleFeed`         | `feed-sync.ts`    |
| `syncFeedArticles`       | `feed-sync.ts`    |
| `writeFeedSyncLog`       | `feed-sync.ts`    |
| `updateFeedMetadata`     | `feed-details.ts` |
| `performArchiveArticles` | `archive.ts`      |
| `autoArchiveArticles`    | `archive.ts`      |

### 3. No context — pure or self-contained

These functions either take explicit params, use module-level `db`, or
are pure transforms. No context needed.

| Function                   | File                   | Notes                                    |
| -------------------------- | ---------------------- | ---------------------------------------- |
| `enqueueStaleFeeds`        | `feed-sync.ts`         | Global cross-user query, uses bare `db`  |
| `autoArchiveForAllUsers`   | `feed-sync.ts`         | Iterates users, creates context per user |
| `enqueueFeedSync`          | `queues.ts`            | Just adds job to queue                   |
| `enqueueFeedDetail`        | `queues.ts`            | Just adds job to queue                   |
| `forceEnqueueFeedSync`     | `queues.ts`            | Just adds job to queue                   |
| `discoverRssFeeds`         | `entities/feed.ts`     | No DB access, calls discovery package    |
| `retryFeed`                | `entities/feed.ts`     | Currently takes explicit `(id, userId)`  |
| `createSettings`           | `entities/settings.ts` | Signup-only, uses bare `db`              |
| `getSettings`              | `entities/settings.ts` | Takes explicit `(userId, conn)`          |
| `getAutoArchiveCutoffDate` | `entities/settings.ts` | Takes explicit `userId`, uses bare `db`  |
| `exportOpmlFeeds`          | `export.ts`            | Takes explicit `userId`                  |
| `getUserUsage`             | `limits.ts`            | Takes explicit `userId`                  |
| `getFeedSyncLogs`          | `feed-sync.ts`         | Takes explicit `(userId, feedId)`        |

### Edge cases resolved

**`retryFeed`** — Currently takes `(id, userId)` and uses bare `db`.
Could take `DomainContext` for consistency but the explicit params are fine
since it's a simple single-query function. No change needed.

**`getSettings`** — Takes `(userId, conn)` explicitly. Used by both
context-aware functions (`updateSettings` passes `ctx.conn`) and
standalone callers (`$$getSettings` handler passes `db`). Keep explicit params.

**`getAutoArchiveCutoffDate`** — Uses bare `db` directly. This is
intentional — it reads settings which are rarely updated, and reading
outside the transaction is acceptable. Keep as-is.

**`autoArchiveForAllUsers`** — Creates a `DomainContext` per user internally.
Stays as a no-context function at its own boundary.

**`syncSingleFeed`** — Uses `DomainContext` (not transaction). It does many
writes but doesn't enqueue jobs itself. The worker calls it with
`createDomainContext(db, userId)`. Individual inserts are independent
(article-by-article), so transactional atomicity isn't required.

## What Changes Where

### 1. `domain-context.ts` — rewrite

Remove `AsyncLocalStorage`, `getUserId()`, `getConn()`, `afterTransactionCommit()`,
`withDomainContext()`. Replace with:

- `DomainContext` and `TransactionContext` interfaces (exported)
- `createDomainContext()` factory
- `withTransaction()` that creates `TransactionContext` and flushes effects

### 2. Queue functions (`queues.ts`) — simplify

Remove `afterTransactionCommit` import and usage. Functions become plain
"add job to queue" with no context awareness:

```ts
export function enqueueFeedSync(userId: string, feedId: string) {
  return getSingleFeedSyncQueue().add(
    feedId,
    { feedId, userId },
    { jobId: `feed-sync-${feedId}`, removeOnComplete: 100, removeOnFail: 500 },
  );
}
```

### 3. Entity functions (`entities/*.ts`) — add ctx param

Replace `getUserId()`/`getConn()` calls with `ctx` parameter.
Functions that enqueue use `ctx.afterCommit(...)`.

Before:

```ts
export async function createFeeds(data: CreateFeed[]): Promise<Feed[]> {
  const userId = getUserId();
  const conn = getConn();
  // ...
  await enqueueFeedSync(userId, feed.id); // was wrapped in afterTransactionCommit
}
```

After:

```ts
export async function createFeeds(ctx: TransactionContext, data: CreateFeed[]): Promise<Feed[]> {
  const { userId, conn } = ctx;
  // ...
  ctx.afterCommit(() => enqueueFeedSync(userId, feed.id));
}
```

### 4. Orchestration functions — add ctx param, thread through

```ts
// follow-feeds.ts
export async function followFeedsWithTags(ctx: TransactionContext, data: FollowFeedsWithTags) {
  const insertedFeeds = await createFeeds(ctx, data.feeds.map(...));
  await createTags(ctx, data.newTags.map(...));
  await createFeedTags(ctx, validFeedTags);
}

// import.ts
export async function importOpmlFeeds(ctx: TransactionContext, opmlContent: string) {
  const { userId, conn } = ctx;
  // ... existing logic, replace getConn()/getUserId() with ctx ...
  ctx.afterCommit(() => enqueueFeedSync(userId, id));
}

// archive.ts
export async function performArchiveArticles(ctx: DomainContext) {
  const { userId, conn } = ctx;
  // ...
}

// feed-sync.ts
export async function syncSingleFeed(ctx: DomainContext, feedId: string) {
  const { userId, conn } = ctx;
  // ...
}

// autoArchiveForAllUsers — creates DomainContext per user internally
export async function autoArchiveForAllUsers() {
  const users = await db.query.user.findMany({ columns: { id: true } });
  for (const u of users) {
    const ctx = createDomainContext(db, u.id);
    await autoArchiveArticles(ctx);
  }
}
```

### 5. Handler boundaries (`*.functions.ts`) — `tx` → `ctx`

Before:

```ts
.handler(async ({ context, data }) => {
  return await withTransaction(db, context.user.id, async (tx) => {
    await feedsDomain.createFeeds(data);
    return { txid: await getTxId(tx) };
  });
});
```

After:

```ts
.handler(async ({ context, data }) => {
  return await withTransaction(db, context.user.id, async (ctx) => {
    await feedsDomain.createFeeds(ctx, data);
    return { txid: await getTxId(ctx.conn) };
  });
});
```

Non-transaction handlers use `createDomainContext`:

Before:

```ts
.handler(({ context }) => {
  return withDomainContext(db, context.user.id, () => domainPerformArchiveArticles());
});
```

After:

```ts
.handler(({ context }) => {
  const ctx = createDomainContext(db, context.user.id);
  return domainPerformArchiveArticles(ctx);
});
```

### 6. Worker boundaries (`workers.ts`)

Before:

```ts
return await withDomainContext(db, userId, () => syncSingleFeed(feedId));
// ...
await withTransaction(db, userId, () =>
  recordFeedSyncFailure(feedId, err, attemptNumber, durationMs),
);
```

After:

```ts
const ctx = createDomainContext(db, userId);
return await syncSingleFeed(ctx, feedId);
// ...
await withTransaction(db, userId, (ctx) =>
  recordFeedSyncFailure(ctx, feedId, err, attemptNumber, durationMs),
);
```

### 7. `index.ts` — update exports

Remove `withDomainContext`, `afterTransactionCommit`.
Export `DomainContext`, `TransactionContext`, `createDomainContext`, `withTransaction`.

## Migration Order

1. Define types + `withTransaction` + `createDomainContext` in `domain-context.ts` (keep old code temporarily)
2. Update entity functions one at a time (add `ctx` param, remove `getUserId()`/`getConn()`)
3. Update orchestration functions (`follow-feeds.ts`, `feed-sync.ts`, `archive.ts`, `import.ts`, `feed-details.ts`)
4. Update queue functions — strip `afterTransactionCommit`, make them plain
5. Update handler boundaries (`*.functions.ts`) — `tx` → `ctx`
6. Update worker boundaries — `withDomainContext` → `createDomainContext`
7. Delete old `AsyncLocalStorage` code, `getUserId`, `getConn`, `withDomainContext`, `afterTransactionCommit`
8. Update `index.ts` exports
9. `bun check-types` — TypeScript catches anything missed

## Files to Change

**packages/domain/src/** (core — change first):

- `domain-context.ts` — rewrite
- `queues.ts` — simplify
- `entities/feed.ts`, `article.ts`, `article-tag.ts`, `feed-tag.ts`, `tag.ts`, `filter-rule.ts`, `settings.ts`
- `follow-feeds.ts`, `feed-sync.ts`, `feed-details.ts`, `archive.ts`, `import.ts`
- `index.ts` — update exports

**apps/web/src/entities/** (handlers — change after domain):

- `feeds.functions.ts`, `articles.functions.ts`, `article-tags.functions.ts`
- `feed-tags.functions.ts`, `tags.functions.ts`, `filter-rules.functions.ts`
- `settings.functions.ts`

**apps/web/src/routes/**:

- `api/feeds.ts`

**apps/worker/src/**:

- `workers.ts`

**No changes needed:**

- `benchmark/runner.ts` — already uses direct queue access
- `*.schema.ts` files — pure, no context
- `export.ts`, `limits.ts` — explicit params, no context
