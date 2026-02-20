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
    Database (PostgreSQL)
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

Using **Electric SQL-powered collections** (`electricCollectionOptions`) with real-time sync and TanStack Start server functions for mutations.

```typescript
// Collection (client-side with Electric SQL sync)
export const feedsCollection = createCollection(
  electricCollectionOptions({
    id: 'feeds',
    schema: FeedSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('feeds'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('feeds.shape'),
    },

    onInsert: collectionErrorHandler('feeds.onInsert', async ({ transaction }) => {
      const feeds = transaction.mutations.map((mutation) => {
        const feed = mutation.modified;
        return { id: mutation.key as string, url: feed.url };
      });
      await $$createFeeds({ data: feeds });
    }),
    onUpdate: async ({ transaction }) => {
      /* batch sync to server */
    },
    onDelete: async ({ transaction }) => {
      /* batch sync to server */
    },
  }),
);
```

Server functions provide type-safe RPC calls with auth middleware, replacing traditional REST endpoints.

## Fire-and-Forget Mutations

Mutations are **fire-and-forget** - no awaiting required:

```typescript
// Good: Fire and forget
updateArticles([{ id, isRead: true }]);
createFeeds([{ url: 'https://example.com/feed' }]);
deleteTags([tagId]);

// Unnecessary: Awaiting persistence
await tx.isPersisted.promise; // Don't do this
```

**Why this works:**

1. **Optimistic updates**: TanStack DB applies changes immediately to local state
2. **Live queries**: UI updates automatically via reactive live queries
3. **Background sync**: Collection handlers (`onUpdate`, `onInsert`, `onDelete`) call server functions
4. **Auto-rollback**: If sync fails, TanStack DB reverts optimistic state

**Future enhancement**: Client-generated UUIDs for inserts would eliminate temp ID mapping entirely, making inserts truly fire-and-forget without server round-trip for ID resolution.

## Sync Engine

Currently using **Electric SQL** for real-time Postgres-to-client sync via shape streams. Collections subscribe to shapes filtered by `user_id`, with automatic reconnection and error handling.

The TanStack DB collection abstraction means the sync engine could be swapped without changing frontend components — only collection configuration needs updating.
