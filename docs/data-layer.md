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

## Data Modeling Consideration

> **TODO**: Article-tag relationship needs restructuring.
>
> Current state: DB has `articles`, `tags`, and `article_tags` junction table (many-to-many). API exposes tags as array inside article object.
>
> Problem: Local-first sync delivers DB structure to frontend. The junction table pattern doesn't translate cleanly when syncing collections directly.
>
> Options:
>
> 1. Change API to expose junction table explicitly (consistent with DB structure)
> 2. Handle transformation at sync layer only
>
> Decision pending - likely change whole API for consistency.

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
