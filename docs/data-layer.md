# Data Layer: Local-First Architecture

## Ideology

Amazing apps feel **instant, real-time, blazingly fast** - no loaders on every page. This is the goal.

**All-in on local-first**: TanStack DB is the primary interface for frontend data interaction. The frontend works with local collections that sync in the background.

## Why TanStack DB

TanStack DB provides an **abstraction layer** over data synchronization:

- Collections as the single source of truth for frontend
- Optimistic mutations with automatic rollback
- Swap underlying sync engines without changing app code
- Progressive enhancement path as tooling matures

## Architecture

```
Frontend (TanStack DB Collections)
         ↓ sync via server functions
    TanStack Start Server Functions
         ↓
    Domain Logic (@repo/domain)
         ↓
    Database (SQLite)
```

**Key principle**: Frontend code only interacts with TanStack DB collections. The sync mechanism is abstracted away via server functions.

## Collections

All entities use TanStack DB collections defined in `apps/web/src/entities/`:

- **Feeds**: `feedsCollection`
- **Tags**: `tagsCollection`
- **Articles**: `articlesCollection`
- **Settings**: `settingsCollection`
- **Filter Rules**: `filterRulesCollection`

Mutations go through collections → optimistic update → server function sync → confirmed state (or rollback on failure).

## Data Modeling: Junction Tables

**Problem**: Local-first sync delivers DB structure to frontend. Junction tables (many-to-many) don't translate cleanly when syncing collections directly - TanStack DB needs flat entities to perform joins client-side.

**Solution**: Intentional data duplication.

Article-tag relationships are exposed in two ways:

1. **`tags` array on Article** - Convenient, keeps article responses self-contained
2. **`articleTagsCollection`** - Returns junction table rows (`{ id, articleId, tagId }`) for TanStack DB client-side joins

This duplication allows:
- Simple usage with embedded tags
- Local-first collections with proper relational structure for client-side joins

Same pattern applies to feed-tags if needed later.

## Current Implementation

Using **query-based collections** (`queryCollectionOptions`) with TanStack Start server functions.

```typescript
// Server function (runs on server)
const $$getAllFeeds = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return feedsDomain.getAllFeeds(db);
  });

// Collection (client-side with sync)
export const feedsCollection = createCollection(
  queryCollectionOptions({
    id: 'feeds',
    queryKey: ['feeds'],
    queryClient,
    getKey: (item) => item.id,
    schema: FeedSchema,
    queryFn: () => $$getAllFeeds(),
    onInsert: async ({ transaction }) => { /* sync to server */ },
    onUpdate: async ({ transaction }) => { /* sync to server */ },
    onDelete: async ({ transaction }) => { /* sync to server */ },
  }),
);
```

Server functions provide type-safe RPC calls with auth middleware, replacing traditional REST endpoints.

## Fire-and-Forget Mutations

Mutations are **fire-and-forget** - no awaiting required:

```typescript
// Good: Fire and forget
updateArticle(id, { isRead: true });
createFeed({ url: 'https://example.com/feed' });
deleteTag(tagId);

// Unnecessary: Awaiting persistence
await tx.isPersisted.promise; // Don't do this
```

**Why this works:**

1. **Optimistic updates**: TanStack DB applies changes immediately to local state
2. **Live queries**: UI updates automatically via reactive live queries
3. **Background sync**: Collection handlers (`onUpdate`, `onInsert`, `onDelete`) call server functions
4. **Auto-rollback**: If sync fails, TanStack DB reverts optimistic state

**Future enhancement**: Client-generated UUIDs for inserts would eliminate temp ID mapping entirely, making inserts truly fire-and-forget without server round-trip for ID resolution.

## Future: Sync Engine Evolution

As the ecosystem matures, can swap to real sync engines:

- **ElectricSQL**: If using Postgres, direct DB-to-client sync
- **Turso**: SQLite-based edge database with sync capabilities
- **PowerSync**: Another Postgres sync option
- **Custom WebSocket sync**: Real-time server push

The transition requires only changing the collection configuration - no frontend component changes needed.
