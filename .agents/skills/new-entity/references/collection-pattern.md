# Collection Pattern (TanStack DB + Electric SQL)

## Collection Definition

Collections are module-scope singletons in `apps/web/src/entities/*.ts`. Each uses `electricCollectionOptions` for real-time sync.

## Error Handlers

### Mutation Errors (`collectionErrorHandler`)

TanStack DB rolls back optimistic state **only if the mutation handler throws**. Every `onInsert`/`onUpdate`/`onDelete` handler must be wrapped with `collectionErrorHandler()`.

```typescript
onInsert: collectionErrorHandler('feeds.onInsert', async ({ transaction }) => {
  const feeds = transaction.mutations.map((mutation) => {
    const feed = mutation.modified;
    return { id: mutation.key as string, url: feed.url };
  });
  return await $$createFeeds({ data: feeds });
}),
```

**Critical:** Never swallow errors in mutation handlers. If the handler doesn't throw, TanStack DB considers the mutation successful and the optimistic state becomes permanent — even if the server rejected it.

**Critical:** Always `return` the server function result from `onInsert`/`onUpdate`/`onDelete` handlers. Server functions return `{ txid }` — TanStack DB uses this to know when the server transaction is confirmed by the Electric sync stream, keeping the optimistic overlay in place until the real data arrives.

### Shape Stream Errors (`shapeErrorHandler`)

Electric shape streams can fail (network, auth expiry). Use `shapeErrorHandler()` which shows a toast but does NOT throw.

```typescript
shapeOptions: {
  onError: shapeErrorHandler('feeds.shape'),
},
```

## Mutations Are Fire-and-Forget

```typescript
// Good: Fire and forget
updateArticles([{ id, isRead: true }]);
createFeeds([{ url: 'https://example.com/feed' }]);

// Unnecessary: Awaiting persistence
await tx.isPersisted.promise; // Don't do this
```

Optimistic updates apply immediately. Background sync handles server persistence. Auto-rollback on failure.

## Toast Service

Collections exist at module scope (outside the SolidJS component tree) — they can't use `useContext()`. The toast service (`src/lib/toast-service.ts`) bridges this gap as a module-scope singleton.

## Key Files

| File                           | Role                                            |
| ------------------------------ | ----------------------------------------------- |
| `src/lib/toast-service.ts`     | Module-scope toast singleton                    |
| `src/lib/collection-errors.ts` | `collectionErrorHandler` + `shapeErrorHandler`  |
| `src/providers/toast.tsx`      | Wires `toastService.showToast` on mount         |
