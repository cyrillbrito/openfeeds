# Articles Collection Migration Plan

## Context

Currently articles use TanStack Query mutations (`useUpdateArticle`) instead of TanStack DB collections. To enable client-first bulk operations (like "mark all as archived"), we need to migrate to a collection-based approach.

## Current State

### Architecture
- **Feeds/Tags:** TanStack DB collections (`apps/web/src/entities/feeds.ts`, `tags.ts`)
- **Articles:** TanStack Query mutations only (`apps/web/src/hooks/queries.ts`)
- **Bulk operations:** Server endpoint `POST /articles/mark-many-read` (server-centric)

### Why Articles Aren't Currently a Collection
Articles are paginated, dynamically filtered, and high-volume - not suited for traditional collection sync pattern where all items are loaded client-side.

### Challenge
Need to reconcile collection-based mutations with paginated/filtered query pattern.

## Migration Steps

### Step 1: Create Articles Collection Definition

**File:** `apps/web/src/entities/articles.ts`

**Pattern from feeds.ts:**
```typescript
import { createCollection, queryCollectionOptions } from '@tanstack/query-db-collection'
import { ArticleSchema } from '@openfeeds/shared/schemas/article'
import type { Article } from '@openfeeds/shared/schemas/article'

export function createArticlesCollection(queryClient: QueryClient) {
  return createCollection(queryCollectionOptions({
    id: 'articles',
    queryKey: ['articles'],
    queryClient,
    getKey: (item: Article) => item.id,
    schema: ArticleSchema,

    // Query function - fetch articles from server
    queryFn: async ({ signal }) => {
      // TODO: How to handle pagination?
      // Option 1: Fetch all articles (bad for large datasets)
      // Option 2: Only fetch visible articles (defeats collection purpose)
      // Option 3: Hybrid approach (discuss)
      const api = useApi()
      const { data } = await api.articles.get({ signal })
      return data?.articles || []
    },

    // Handle client-side creates (probably not needed for articles)
    onInsert: async ({ transaction }) => {
      // Articles are created server-side via RSS fetch
      // May not need client-side creation
    },

    // Handle client-side updates
    onUpdate: async ({ transaction }) => {
      const api = useApi()
      for (const mutation of transaction.mutations) {
        const article = mutation.modified
        const changes = mutation.changes

        // Send only changed fields
        await api.articles({ id: article.id }).put({
          isRead: changes.isRead,
          isArchived: changes.isArchived,
          tags: changes.tags,
        })
      }
    },

    // Handle client-side deletes (probably not needed)
    onDelete: async ({ transaction }) => {
      // Articles are typically archived, not deleted
    },
  }))
}
```

**Key Questions to Resolve:**
1. How to handle pagination in queryFn?
2. Do we need onInsert/onDelete for articles?
3. How to preserve per-query filtering (inbox vs feed vs tag)?

### Step 2: Address Pagination Challenge

**Problem:** Collections expect to load all items, but articles are paginated.

**Options:**

**A. Hybrid Approach (Recommended)**
- Keep existing `useArticles()` query for fetching/displaying
- Use collection ONLY for mutations (onUpdate)
- Collection's queryFn returns empty array (mutations don't need data)
- After mutations, invalidate `['articles']` queries to refetch

**B. Per-Context Collections**
- Create separate collection instances per context (inbox, feed, tag)
- Each loads its own subset
- Complex state management

**C. Virtual Collection**
- Collection doesn't fetch, only handles mutations
- Manually sync collection state with query results

**Decision:** Start with Option A (hybrid)

### Step 3: Integrate Collection with Existing Hooks

**File:** `apps/web/src/hooks/queries.ts`

**Current `useUpdateArticle`:**
```typescript
export function useUpdateArticle() {
  const queryClient = useQueryClient()
  const api = useApi()

  return useMutation(() => ({
    mutationFn: async ({ id, ...input }: UpdateArticleInput) => {
      // API call
    },
    onMutate: async ({ id, isRead, isArchived, tags }) => {
      // Optimistic updates via produce()
    },
    onError: (error, variables, context) => {
      // Rollback
    },
    onSettled: () => {
      // Invalidate queries
    },
  }))
}
```

**New approach using collection:**
```typescript
export function useUpdateArticle() {
  const articlesCollection = useArticlesCollection()

  return useMutation(() => ({
    mutationFn: async ({ id, ...updates }: UpdateArticleInput) => {
      // Use collection's update method
      await articlesCollection.update(id, updates)
    },
    // Collection handles optimistic updates automatically
    // Collection handles server sync via onUpdate
  }))
}
```

**Simplification:** Collection handles optimistic updates, rollback, server sync.

### Step 4: Update Collection Registry

**File:** `apps/web/src/hooks/collections.ts`

Add:
```typescript
import { createArticlesCollection } from '../entities/articles'

// Existing code...

export const articlesCollection = createArticlesCollection(queryClient)

// Or if using factory pattern:
export function useArticlesCollection() {
  const queryClient = useQueryClient()
  return createArticlesCollection(queryClient)
}
```

### Step 5: Test Migration

**Manual Testing:**
1. Archive single article → check UI update, server persistence
2. Update tags on article → check sync
3. Mark article as read → check sync
4. Check rollback on network error
5. Verify pagination still works in article lists

**Edge Cases:**
- Partial failures in batch updates
- Network offline → online sync
- Concurrent updates to same article

### Step 6: Implement "Mark All as Archived" (Client-First)

**File:** `apps/web/src/hooks/queries.ts`

```typescript
export function useMarkAllAsArchived() {
  const queryClient = useQueryClient()
  const articlesCollection = useArticlesCollection()
  const api = useApi()

  return useMutation(() => ({
    mutationFn: async ({ context, feedId, tagId }: MarkAllContext) => {
      // 1. Fetch article IDs for context
      const { data } = await api.articles.ids.get({
        query: { context, feedId, tagId, archived: false }
      })

      const articleIds = data?.articleIds || []

      // 2. Batch update via collection
      // Option A: Sequential
      for (const id of articleIds) {
        await articlesCollection.update(id, { isArchived: true })
      }

      // Option B: Concurrent (limit concurrency)
      await Promise.all(
        articleIds.map(id =>
          articlesCollection.update(id, { isArchived: true })
        )
      )

      return { markedCount: articleIds.length }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['articles'] })
    },
  }))
}
```

**Backend endpoint needed:**
- `GET /articles/ids?context=all|feed|tag&feedId=X&tagId=Y&archived=false`
- Returns `{ articleIds: number[] }`

### Step 7: Update UI Components

**Changes:**
1. Rename `MarkAllReadButton` → `MarkAllAsArchivedButton`
2. Update text: "Mark all as read" → "Mark all as archived"
3. Use `useMarkAllAsArchived()` hook
4. Show progress indicator for batch operation
5. Handle partial failures with user feedback

**Locations:**
- `apps/web/src/components/MarkAllReadButton.tsx` (rename/refactor)
- `apps/web/src/routes/_frame.inbox.index.tsx:128`
- `apps/web/src/routes/_frame.feeds.$feedId.index.tsx:207`
- `apps/web/src/routes/_frame.tags.$tagId.tsx:96`

### Step 8: Cleanup

**Remove:**
1. `POST /articles/mark-many-read` endpoint (`apps/server/src/apps/articles.ts:57-70`)
2. `markManyArticlesRead()` function (`packages/domain/src/articles.ts:238-295`)
3. `useMarkManyRead()` hook (`apps/web/src/hooks/queries.ts:396-412`)
4. Legacy modal code in feed/tag routes (duplicate implementations)
5. `MarkManyReadRequestSchema`, `MarkManyReadResponseSchema` schemas

## Open Questions

1. **Pagination in Collections:** How to handle fetching articles in queryFn when we have infinite scroll?
   - Proposal: Collection queryFn returns `[]`, only used for mutations

2. **Performance:** Will individual HTTP requests per article be acceptable?
   - Mitigation: Batch requests, limit concurrency, show progress

3. **Partial Failures:** How to handle when some articles fail to archive?
   - Proposal: Show toast with "X of Y archived, Z failed. Retry?"

4. **Offline Support:** Does TanStack DB collection handle offline mutations?
   - Research: Check if collection queues mutations when offline

5. **Filtering:** How to maintain per-query filtering (inbox/feed/tag) with collection?
   - Proposal: Collection mutations work independently of query filtering

## Benefits of This Approach

✅ Client-first architecture aligned with TanStack DB philosophy
✅ Consistent mutation pattern across all entities
✅ Automatic optimistic updates via collection
✅ Better offline support potential
✅ Granular error handling per article
✅ Removes server-centric bulk endpoint

## Risks

⚠️ More complex than simple bulk endpoint
⚠️ More HTTP requests (mitigated by batching)
⚠️ Pagination/collection mismatch needs careful design
⚠️ Migration may introduce regressions

## Timeline

1. **Phase 1:** Create articles collection (Step 1-4)
2. **Phase 2:** Test and validate (Step 5)
3. **Phase 3:** Implement mark all as archived (Step 6-7)
4. **Phase 4:** Cleanup old code (Step 8)

## Next Steps

1. Decide on pagination approach (Option A recommended)
2. Create `apps/web/src/entities/articles.ts`
3. Add backend `GET /articles/ids` endpoint
4. Implement hybrid collection (mutations only)
5. Test single article updates via collection
6. Implement batch "mark all as archived"
