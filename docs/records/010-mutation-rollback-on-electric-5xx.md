---
date: 2026-05-16
status: shipped
---

# Optimistic Mutation Rollback on Electric 5xx Backoff

## Symptom

Archived articles silently reverted to unarchived after a delay in production. UI showed archive succeeded, then ~30s later the article reappeared in the inbox. A page refresh restored the correct (archived) state, so the database was fine — the bug was in the client-side optimistic state.

Not reproducible locally. The PostHog instance recorded no related errors.

## Investigation

HAR captures (`network.json`, `network_2.json`) of two reproductions showed:

1. Client `POST /_serverFn/...` for `updateArticles` returned `200` with a valid `txid`.
2. Electric `live=true` long-poll for the `articles` shape returned `502` shortly after, then again ~80s later, with no stream messages in between.
3. The optimistic state reverted exactly when the 5s `awaitTxId` default fired.

Decoding the seroval-encoded mutation payload revealed a second, contributing bug: the client was sending `{ id, isRead: undefined, isArchived: true }` on archive (and the mirror on read), because the old `onUpdate` handler used an explicit `{ id, isRead: mutation.changes.isRead, isArchived: mutation.changes.isArchived }` shape. Server-side `updateArticles` filters undefined so the DB was unaffected, but the explicit shape was the wrong convention — every other entity (`tags`, `feeds`, `filter-rules`, `settings`) spreads `...mutation.changes`.

## Root cause

Two issues compounding:

1. **`awaitTxId` timeout (5s default) shorter than Electric's 5xx backoff window.** Electric's client auto-retries shape failures with exponential backoff. Windows comfortably exceed 5s. When a mutation lands during a backoff window, the server commits but the txid never appears in the stream in time — `electric-db-collection` throws `TimeoutWaitingForTxIdError`, TanStack DB treats the mutation as failed and rolls back the optimistic state. The next sync delivers the actual committed row, but by then the UI has flickered back.
2. **Explicit field list in articles `onUpdate`** — out of step with every other entity, made future field additions a footgun, and produced confusing `undefined` payloads in HAR traces.

## Fix

`apps/web/src/lib/collection-errors.ts`:

- `AWAIT_TXID_TIMEOUT_MS = 30_000` — `collectionErrorHandler` injects `{ timeout: 30_000 }` into the handler's `{ txid }` return value unless the handler set its own.
- `shapeErrorHandler` retries forever (returns `{}`) for all errors except `401`. Previous behavior was to stop syncing on exhausted retries, leaving the user with a stale UI only a refresh could fix.

`apps/web/src/entities/articles.ts`:

- `onUpdate` now spreads `...mutation.changes` to match every other entity.

## Verification

Reproduction after deploy showed the expected behaviour:

```
[mutation:start] articles.onUpdate mutationId=s785zfod
[sync:articles] update key=... $synced=false $origin=local isArchived=true
[mutation:server_ok] articles.onUpdate elapsedMs=494 txid=11676668
```

Articles shape 502'd for ~24s right after the mutation. With the old 5s timeout this would have rolled back. With 30s, `awaitTxId(11676668, 30000)` rode out the backoff and the optimistic state stayed.

The debug logging used during the investigation (lifecycle console logs in `collectionErrorHandler`, `attachCollectionChangeLogger` for `articles`, server-side `[server:articles.update]` + `[server:electric_response]` console logs, `x-mutation-id` correlation header) has been removed now that the bug is understood.

## Known unrelated noise

PostHog reports occasional `INSERT INTO article_tags ... unique_article_tag` violations (~25 occurrences across 3 months, single user). Likely the same family — a mutation the client thinks failed gets re-applied — but harmless and out of scope for this fix. Add `ON CONFLICT DO NOTHING` to `createArticleTags` when next touched.

## Conventions to preserve

- **Always spread `...mutation.changes` in `onUpdate` handlers.** Never enumerate individual fields. Sending `undefined` for unchanged fields is wasteful and historically caused confusion when reading payloads.
- **Don't lower `AWAIT_TXID_TIMEOUT_MS`.** Electric's retry backoff is the floor.
- **Don't make `shapeErrorHandler` stop syncing on non-401 errors.** A stale UI is worse than indefinite retries.
