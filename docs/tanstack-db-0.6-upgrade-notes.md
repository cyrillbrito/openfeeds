# TanStack DB 0.6 Upgrade Notes

Source: https://tanstack.com/blog/tanstack-db-0.6-app-ready-with-persistence-and-includes

Current version: `@tanstack/db` 0.6.1, `@tanstack/solid-db` 0.2.15, `@tanstack/electric-db-collection` 0.2.43

---

## Features Shipped in 0.6

1. **Includes** — project normalized data into hierarchical UI shape (like GraphQL, client-side)
2. **Persistence** — SQLite-backed local state across browser (WASM), React Native, Node, Electron, etc.
3. **`createEffect`** — reactive side effects triggered by live query result deltas
4. **Virtual props** (`$synced`, `$origin`, `$key`, `$collectionId`) — row-level sync state in queries
5. **`queryOnce`** — one-shot query using the same language as live queries
6. **Indexes opt-in** — indexing code excluded from bundle unless configured; `defaultIndexType` + `autoIndex` pattern
7. **Magic return removal** — mutation handlers no longer use implicit return values; sync coordination is now explicit

---

## Feature-by-Feature Assessment

### 1. Includes

**Priority: High**

Current pain: related data is joined manually or stitched in JS:
- `feed-tags` relationship: components like `FeedHeader` query `feedTagsCollection` then `.filter(ft => ft.feedId === id)` in plain JS accessors
- `_frame.tags.$tagId.articles.tsx` uses `innerJoin` + junction table to get tag-filtered articles — works but mixes junction rows into result shape
- Any view showing a feed with its tags must query two collections and manually zip them

What to do — replace JS stitching with `includes`:

```ts
// feeds with their tags — replaces manual feedTagsCollection.filter() pattern
const feedsWithTags = createLiveQueryCollection((q) =>
  q.from({ feed: feedsCollection }).select(({ feed }) => ({
    ...feed,
    tags: toArray(
      q.from({ ft: feedTagsCollection })
        .where(({ ft }) => eq(ft.feedId, feed.id))
        .join({ tag: tagsCollection }, ({ ft, tag }) => eq(ft.tagId, tag.id))
        .select(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
    ),
  })),
)
```

Use `toArray()` for tag lists (small, no child render boundary needed). Use child collections (default) for article lists inside feeds.

Also applicable to:
- Articles with their tags (currently `innerJoin` + `articleTagsCollection`)
- Article detail view needing feed metadata

---

### 2. Magic Return Removal

**Priority: Check / Low risk**

The 0.6 migration removes implicit "magic return" from mutation handlers. Two patterns were removed:
- `QueryCollection`: returning `{ refetch: false }` from handlers
- `ElectricCollection`: returning `{ txid }` from handlers (previously auto-wired to `awaitTxId`)

**Status in this codebase:** All collections use `electricCollectionOptions` from `@tanstack/electric-db-collection`. The txid handling is internal to that wrapper — not user-land code. All handlers return the server function result (which includes `{ txid }`), and the wrapper handles the rest.

The `follow-feeds.ts` `createOptimisticAction` already uses the explicit pattern:
```ts
// follow-feeds.ts:65 — already the "new" explicit style
await feedsCollection.utils.awaitTxId(txid)
```

**Action:** Verify `@tanstack/electric-db-collection` changelog to confirm its internal txid handling is updated for 0.6. No user-land changes expected.

---

### 3. Indexes — Opt-in

**Priority: Medium**

Current state:
- `articles`, `tags`, `article-tags`, `feed-tags` → `autoIndex: 'eager'` + `BasicIndex` ✓
- `feeds`, `filter-rules`, `settings` → **no index config**

`feeds` is queried with `useLiveQuery` everywhere (no filter, just full scan). `filter-rules` is frequently filtered by `feedId` (e.g. `eq(rule.feedId, feedId)`).

There is already a TODO in `articles.ts:19` to switch from `autoIndex: 'eager'` to explicit `createIndex` calls per field for more control over memory usage.

**Actions:**
1. Add `autoIndex: 'eager'` + `defaultIndexType: BasicIndex` to `feeds.ts` and `filter-rules.ts`
2. Follow through on the TODO: replace `autoIndex: 'eager'` with explicit `createIndex` calls for known fields (`pubDate`, `isArchived`, `isRead`, `feedId`, etc.)

---

### 4. Virtual Props (`$synced`, `$origin`)

**Priority: Low**

The app currently has no visual sync state indicators. When a user archives an article, marks it read, or follows a feed, there's no UI feedback that the mutation is still in-flight vs. confirmed.

`$synced: false` = row is optimistic (not yet confirmed by Electric sync)
`$origin` = whether last confirmed change came from this client or upstream

**What could be added:**
```ts
// Outbox: articles with pending mutations
const unsyncedArticles = useLiveQuery((q) =>
  q.from({ a: articlesCollection })
    .where(({ a }) => eq(a.$synced, false))
    .select(({ a }) => ({ id: a.id }))
)
// Use to show a subtle "saving..." indicator on article rows
```

Pairs well with `createEffect` to retry/alert on stuck mutations.

---

### 5. `createEffect`

**Priority: Low (browser); Interesting (server/edge)**

No obvious workflow automation use case in the browser app. Background job processing already lives in `apps/worker/` via BullMQ.

Potential future use: if architecture moves toward Cloudflare Durable Objects or edge workers, `createEffect` + persistence could replace BullMQ for lightweight workflows (e.g. trigger feed fetch when `syncStatus` enters `'pending'`).

---

### 6. `queryOnce`

**Priority: Low**

Most queries in a reactive UI should stay live. Cleanup opportunities:

- `follow-feeds.ts:35` reads `tagsCollection.toArray` directly (bypasses query engine) — could use `queryOnce`
- Route loaders that pre-check data existence before render
- Count queries that don't need to stay reactive (e.g. one-time checks in server functions)

---

### 7. Persistence (SQLite WASM)

**Priority: Hold — revisit when stable**

This is a browser-only web app. SQLite WASM adds ~2-3MB to the bundle. Electric SQL sync already covers the cold-start problem (re-syncs on reload). Persistence would make restarts faster and enable true offline-first.

The blog notes this is the **first alpha** of persistence. For an RSS reader syncing thousands of articles, faster restarts are a real UX win — but the bundle cost and alpha stability need evaluation.

**Revisit:** When `@tanstack/db-sqlite-persistence` (browser variant) reaches beta and bundle size is confirmed acceptable.

---

## Summary

| Feature | Priority | Action |
|---|---|---|
| Includes | High | Replace JS stitching in `FeedHeader` + tag views |
| Magic return migration | Check | Verify `electric-db-collection` internals; low risk |
| Explicit indexes | Medium | Add to `feeds` + `filter-rules`; convert `autoIndex` → `createIndex` |
| Virtual props | Low | Add sync indicators when UX warrants |
| `createEffect` | Low | No browser use case now |
| `queryOnce` | Low | Minor cleanup |
| Persistence | Hold | Alpha + WASM bundle cost; revisit at beta |
