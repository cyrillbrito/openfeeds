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
         ↓ sync
    Sync Layer (pluggable)
         ↓
    Backend / Database
```

**Key principle**: Frontend code only interacts with TanStack DB collections. The sync mechanism is abstracted away.

## Collections

All entities use TanStack DB collections:

- **Feeds**: `feedsCollection`
- **Tags**: `tagsCollection`
- **Articles**: `articlesCollection`

Mutations go through collections → optimistic update → background sync → confirmed state (or rollback on failure).

## Data Modeling: Junction Tables

**Problem**: Local-first sync delivers DB structure to frontend. Junction tables (many-to-many) don't translate cleanly when syncing collections directly - TanStack DB needs flat entities to perform joins client-side.

**Solution**: Intentional data duplication.

Article-tag relationships are exposed in two ways:

1. **`tags` array on Article** - Convenient for API consumers, keeps article responses self-contained
2. **`/article-tags` endpoint** - Returns junction table rows (`{ id, articleId, tagId }`) for TanStack DB collections

This duplication allows:
- Traditional API usage with embedded tags
- Local-first collections with proper relational structure for client-side joins

Same pattern applies to feed-tags if needed later.

## Current Implementation

Using **query-based collections** (`queryCollectionOptions`) - data loaded via API endpoints into TanStack DB collections.

```typescript
const articlesCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['articles'],
    queryFn: async () => api.articles.get(),
    queryClient,
    getKey: (item) => item.id,
    onUpdate: async ({ transaction }) => {
      // Sync mutations to backend
    },
  }),
);
```

Not fully optimized yet - still HTTP request/response pattern. But abstracts the sync mechanism so frontend code remains unchanged when upgrading.

## Future: Sync Engine Evolution

As the ecosystem matures, can swap to real sync engines:

- **ElectricSQL**: If using Postgres, direct DB-to-client sync
- **Turso**: SQLite-based edge database with sync capabilities
- **PowerSync**: Another Postgres sync option
- **Custom WebSocket sync**: Real-time server push

The transition requires only changing the collection configuration - no frontend component changes needed.
