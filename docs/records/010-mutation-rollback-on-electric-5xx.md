---
date: 2026-05-16
status: shipped
---

# Optimistic Mutation Rollback on Electric 5xx Backoff

Optimistic mutations rolled back even when the server had committed, because `awaitTxId`'s 5s default is shorter than Electric's 5xx auto-retry backoff windows. When a mutation lands during a backoff window, the txid never reaches the stream in time → `TimeoutWaitingForTxIdError` → TanStack DB rolls back → the next sync redelivers the actual committed row, flickering the UI.

## Fix

`apps/web/src/lib/collection-errors.ts`:

- `AWAIT_TXID_TIMEOUT_MS = 30_000`, injected into every `{ txid }` returned by a handler unless the handler set its own `timeout`.
- `shapeErrorHandler` retries forever (returns `{}`) for everything except `401` (which redirects to `/login`). Stopping shape sync leaves a stale UI only a refresh can fix.

`apps/web/src/entities/articles.ts`:

- `onUpdate` spreads `...mutation.changes`. The previous explicit `{ isRead, isArchived }` shape sent `undefined` for the unchanged field on every toggle.

## Conventions to preserve

- **Always spread `...mutation.changes` in `onUpdate` handlers.** Never enumerate individual fields — that re-introduces the `undefined` payload bug.
- **Don't lower `AWAIT_TXID_TIMEOUT_MS`.** Electric's 5xx backoff is the floor.
- **Don't make `shapeErrorHandler` stop syncing on non-401 errors.**
