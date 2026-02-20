# Batch Entity Mutations — Implementation Plan

> **Status: COMPLETED** — All steps implemented and verified. Types pass, lint clean.

## Goal

Replace the current `Promise.all(data.map(item => domain.singleOp(item)))` pattern with true batch domain functions (modeled after feed-tags/article-tags), making all entity CRUD consistent and efficient.

## Decisions Made

- **Batch-only API** — replace single-item domain functions with batch ones (single item = array of 1)
- **DB constraints (hybrid)** — use `onConflictDoNothing` for batch inserts; identify skipped rows and throw `ConflictError` with user-friendly messages for entities where it matters (feeds, tags)
- **Transaction wrapper for updates** — batch updates use `db.transaction()` with individual updates inside (atomic, simple)
- **Skip Phase 2** — background job optimizations (sync loop, OPML import) deferred

---

## Step 1: Feeds — Batch Domain Functions

**File:** `packages/domain/src/entities/feed.ts`

### Remove

- `assertFeedExists` (no longer needed — batch delete uses `inArray` with `userId` filter, batch update inside transaction)
- `createFeed` (replaced by `createFeeds`)
- `updateFeed` (replaced by `updateFeeds`)
- `deleteFeed` (replaced by `deleteFeeds`)

### Add

**`createFeeds(data: CreateFeed[], userId: string): Promise<Feed[]>`**

- Build values array from data
- `db.insert(feeds).values(values).onConflictDoNothing({ target: [feeds.userId, feeds.feedUrl] }).returning()`
- Compare `inserted.length` vs `data.length` — if any skipped, find which URLs conflicted, throw `ConflictError('Feed with this URL already exists')`
- `Promise.all` to enqueue `enqueueFeedDetail` + `enqueueFeedSync` for each inserted feed
- Track analytics per feed

**`updateFeeds(data: (UpdateFeed & { id: string })[], userId: string): Promise<void>`**

- `db.transaction()` wrapping individual updates
- Each update: strip undefined fields, `tx.update(feeds).set(data).where(and(eq(feeds.id, id), eq(feeds.userId, userId)))`

**`deleteFeeds(ids: string[], userId: string): Promise<void>`**

- Single `db.delete(feeds).where(and(inArray(feeds.id, ids), eq(feeds.userId, userId)))`
- Track analytics per id

### Keep unchanged

- `retryFeed` (single-item operation, not called from collections)
- `discoverRssFeeds` (not a CRUD op)
- `toApiFeed` helper

### Update `apps/web/src/entities/feeds.server.ts`

Replace:

```ts
// OLD
.handler(({ context, data }) => {
  return Promise.all(data.map((feed) => feedsDomain.createFeed(feed, context.user.id)));
});
```

With:

```ts
// NEW
.handler(({ context, data }) => {
  return feedsDomain.createFeeds(data, context.user.id);
});
```

Same pattern for `$$updateFeeds` and `$$deleteFeeds` — direct passthrough to batch domain function.

---

## Step 2: Tags — Batch Domain Functions

**File:** `packages/domain/src/entities/tag.ts`

### Remove

- `assertTagExists`
- `createTag` (replaced by `createTags`)
- `updateTag` (replaced by `updateTags`)
- `deleteTag` (replaced by `deleteTags`)

### Add

**`createTags(data: CreateTag[], userId: string): Promise<void>`**

- `db.insert(tags).values(values).onConflictDoNothing({ target: [tags.userId, tags.name] }).returning()`
- Note: DB unique index is on `(userId, name)` — case-sensitive at DB level. The existing code does case-insensitive checks. Two options:
  - Option A: Add a lowercase unique index in a migration, then use `onConflictDoNothing`
  - Option B: Keep a pre-check query for case-insensitive dupe detection (a single `SELECT ... WHERE lower(name) IN (...)` for the batch)
- **Recommendation:** Option B — single batch pre-check query, no migration needed:
  ```ts
  const existingNames = await db.query.tags.findMany({
    where: and(
      eq(tags.userId, userId),
      inArray(
        sql`lower(${tags.name})`,
        names.map((n) => n.toLowerCase()),
      ),
    ),
    columns: { name: true },
  });
  if (existingNames.length > 0) throw new ConflictError('Tag name already exists');
  ```
- Then `db.insert(tags).values(values).returning()`
- Track analytics per tag

**`updateTags(data: (UpdateTag & { id: string })[], userId: string): Promise<void>`**

- `db.transaction()` wrapping individual updates
- If `name` provided, do case-insensitive dupe check per item (same as current but inside tx)

**`deleteTags(ids: string[], userId: string): Promise<void>`**

- Single `db.delete(tags).where(and(inArray(tags.id, ids), eq(tags.userId, userId)))`
- Track analytics per id

### Update `apps/web/src/entities/tags.server.ts`

Same pattern — replace `Promise.all(data.map(...))` with direct `tagsDomain.createTags(data, userId)` etc.

---

## Step 3: Articles — Batch Update

**File:** `packages/domain/src/entities/article.ts`

### Remove

- `assertArticleExists` (no longer needed for batch update)
- `updateArticle` (replaced by `updateArticles`)

### Add

**`updateArticles(data: (UpdateArticle & { id: string })[], userId: string): Promise<void>`**

- `db.transaction()` wrapping individual updates
- Each: `tx.update(articles).set(updates).where(and(eq(articles.id, id), eq(articles.userId, userId)))`

### Keep unchanged

- `createArticle` — stays single-item (special flow with content extraction + writeUpdate back to client)
- `getArticleById` — read operation
- `extractArticleContent` — special single-item operation

### Update `apps/web/src/entities/articles.server.ts`

Replace `Promise.all(data.map(...))` in `$$updateArticles` with `articlesDomain.updateArticles(data, userId)`.

---

## Step 4: Filter Rules — Batch Domain Functions

**File:** `packages/domain/src/entities/filter-rule.ts`

### Remove

- `assertFilterRuleExists`
- `createFilterRule` (replaced by `createFilterRules`)
- `updateFilterRule` (replaced by `updateFilterRules`)
- `deleteFilterRule` (replaced by `deleteFilterRules`)

### Add

**`createFilterRules(data: CreateFilterRule[], userId: string): Promise<void>`**

- `db.insert(filterRules).values(values).returning()`
- No conflict handling needed (no uniqueness constraint on filter rules)
- Track analytics per rule

**`updateFilterRules(data: (UpdateFilterRule & { id: string })[], userId: string): Promise<void>`**

- `db.transaction()` wrapping individual updates

**`deleteFilterRules(ids: string[], userId: string): Promise<void>`**

- Single `db.delete(filterRules).where(and(inArray(filterRules.id, ids), eq(filterRules.userId, userId)))`

### Update `apps/web/src/entities/filter-rules.server.ts`

Same pattern — direct passthrough to batch domain functions.

---

## Step 5: Parallelize articles.onInsert

**File:** `apps/web/src/entities/articles.ts`

Replace:

```ts
for (const mutation of transaction.mutations) {
  // ... sequential await per mutation
}
```

With:

```ts
await Promise.all(
  transaction.mutations
    .filter((m) => m.modified.feedId === null && m.modified.url)
    .map(async (mutation) => {
      const article = await $$createArticle({
        data: { id: mutation.key as string, url: mutation.modified.url! },
      });
      articlesCollection.utils.writeUpdate({ ... });
    }),
);
```

---

## Step 6: Consistency Cleanup

### Fix `createArticle` extra query (`article.ts:138-152`)

- Use `.returning()` on the insert instead of calling `getArticleById` afterward
- Map the returned DB row to `Article` type inline

### Fix `createFeedTags` missing conflict handling (`feed-tag.ts:32`)

- Add `.onConflictDoNothing({ target: [feedTags.feedId, feedTags.tagId] })` to the insert
- This prevents crashes on duplicate feed-tag associations

### Fix `createArticleTags` same issue (`article-tag.ts:35`)

- Add `.onConflictDoNothing({ target: [articleTags.articleId, articleTags.tagId] })`

### Standardize return types

- `createTags` → return created tags array (via `.returning()`)
- `createFilterRules` → return created rules array (via `.returning()`)
- All batch create functions return their created entities

---

## Step 7: Wrap Related Ops in Transactions

- `createFeeds`: Wrap insert + queue dispatching? Not needed — queue dispatch failures shouldn't roll back the insert. Keep as-is.
- `updateTags` with name dupe check: The dupe check + update should be in the same transaction to prevent TOCTOU races. Already handled since we're using `db.transaction()`.

---

## Step 8: Verify Server Functions Are Trivial Pass-throughs

After all changes, every `*.server.ts` collection handler should follow this pattern:

```ts
.handler(({ context, data }) => {
  return entityDomain.batchOp(data, context.user.id);
});
```

No `Promise.all`, no mapping, no fan-out.

---

## Files Changed Summary

| File                                           | Changes                                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/entities/feed.ts`         | Replace `createFeed`/`updateFeed`/`deleteFeed` with `createFeeds`/`updateFeeds`/`deleteFeeds`. Remove `assertFeedExists`. |
| `packages/domain/src/entities/tag.ts`          | Replace `createTag`/`updateTag`/`deleteTag` with `createTags`/`updateTags`/`deleteTags`. Remove `assertTagExists`.        |
| `packages/domain/src/entities/article.ts`      | Replace `updateArticle` with `updateArticles`. Remove `assertArticleExists`. Fix `createArticle` to use `.returning()`.   |
| `packages/domain/src/entities/filter-rule.ts`  | Replace `createFilterRule`/`updateFilterRule`/`deleteFilterRule` with batch versions. Remove `assertFilterRuleExists`.    |
| `packages/domain/src/entities/feed-tag.ts`     | Add `onConflictDoNothing` to `createFeedTags` insert.                                                                     |
| `packages/domain/src/entities/article-tag.ts`  | Add `onConflictDoNothing` to `createArticleTags` insert.                                                                  |
| `apps/web/src/entities/feeds.server.ts`        | Replace `Promise.all(data.map(...))` with direct batch domain calls.                                                      |
| `apps/web/src/entities/tags.server.ts`         | Same.                                                                                                                     |
| `apps/web/src/entities/articles.server.ts`     | Same for `$$updateArticles`.                                                                                              |
| `apps/web/src/entities/filter-rules.server.ts` | Same.                                                                                                                     |
| `apps/web/src/entities/articles.ts`            | Parallelize `onInsert` with `Promise.all`.                                                                                |

### Additional callers (verified via grep)

The old single-item functions are **not** called from other domain modules (import/feed-sync use their own inline DB logic). The only extra caller is:

- **`apps/web/src/routes/api/feeds.ts:50`** — API route for browser extension calls `feedsDomain.createFeed()` directly
  - Update to: `const [feed] = await feedsDomain.createFeeds([{ url: body.url }], session.user.id);`

Also: `retryFeed` in `feed.ts` still needs `assertFeedExists` — keep it as a private function.

---

## Verification

1. `bun check-types` — must pass
2. `bun lint` — must pass
3. Manual test: create/update/delete feeds, tags, articles, filter rules through the UI
4. Check that Electric SQL sync still works correctly after mutations
