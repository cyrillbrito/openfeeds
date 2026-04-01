# Scroll Restoration for Article Lists

## Problem

Navigating from a list (inbox, feed, tag) to an article detail (`/articles/$articleId`) and then back loses the user's scroll position. The list route unmounts entirely, resetting `visibleCount` to 20. Even though TanStack Router's `scrollRestoration: true` saves the `scrollY`, the DOM is too short to scroll to — the loaded pages are gone.

User impact: after loading 4-5 pages (80-100 articles), reading one, and going back, you restart from scratch.

## Root Cause

Two things must be restored, but only one is handled:

| What                              | Currently Restored? | Notes                                                        |
| --------------------------------- | ------------------- | ------------------------------------------------------------ |
| `window.scrollY`                  | Yes                 | TanStack Router `scrollRestoration: true` in `router.tsx:12` |
| `visibleCount` (pagination state) | No                  | Local `createSignal(ARTICLES_PER_PAGE)` — resets on remount  |

Without the correct `visibleCount`, the DOM contains only 20 items. The router tries to scroll to e.g. `scrollY=4000` but the page is ~1500px tall. Restoration silently fails.

Additionally, even the current 20-item render is heavy. Each `ArticleCard` creates:

- `ArticleTagManager` with a **live query per card** (`useLiveQuery` for article-tag relationships)
- `TimeAgo` with a **reactive timer per card** (`createTimeAgo` from solid-primitives)
- Multiple `twMerge()` calls, `URL` constructor for YouTube detection, `innerHTML` parsing
- ~30-40 DOM nodes per card

Rendering 80-100 cards (after several "Load More" clicks) is expensive even without scroll restoration concerns.

## Affected Routes

All three list routes have the same pattern:

- `_frame.inbox.index.tsx:35` — `createSignal(ARTICLES_PER_PAGE)`
- `_frame.feeds.$feedId.index.tsx` — same
- `_frame.tags.$tagId.articles.tsx` — same

## Solution: Virtualized List with `@tanstack/solid-virtual`

Replace "Load More" pagination with a virtualized list. Only ~10-15 cards exist in the DOM at any time regardless of total count. Combined with `useElementScrollRestoration` from `@tanstack/solid-router`, scroll position restores perfectly on back-navigation.

### Why Virtualization Over Simpler Options

| Alternative                          | Why not                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Persist `visibleCount` in URL params | Solves scroll but not render performance. 80+ cards with live queries is still slow. |
| Persist in `sessionStorage`          | Same perf issue. Also less predictable than URL state.                               |
| `keepAlive` / route caching          | No built-in router support. Memory cost. Hacky.                                      |

Virtualization solves **both** problems: scroll restoration and render performance.

### Architecture Overview

```
┌──────────────────────────────────────────┐
│ Route (inbox / feed / tag)               │
│                                          │
│  useLiveQuery → all articles (no limit)  │
│  totalCount from query result length     │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ VirtualArticleList                 │  │
│  │                                    │  │
│  │  useElementScrollRestoration       │  │
│  │  createVirtualizer                 │  │
│  │    count = articles.length         │  │
│  │    estimateSize = ~160px           │  │
│  │    initialOffset = scrollEntry     │  │
│  │    overscan = 3                    │  │
│  │    measureElement (dynamic height) │  │
│  │                                    │  │
│  │  ┌──────────────────────────────┐  │  │
│  │  │ Scroll container             │  │  │
│  │  │ data-scroll-restoration-id   │  │  │
│  │  │                              │  │  │
│  │  │  ┌ spacer (getTotalSize) ──┐ │  │  │
│  │  │  │                         │ │  │  │
│  │  │  │  [ArticleCard] visible  │ │  │  │
│  │  │  │  [ArticleCard] visible  │ │  │  │
│  │  │  │  [ArticleCard] visible  │ │  │  │
│  │  │  │  ... ~10-15 items       │ │  │  │
│  │  │  │                         │ │  │  │
│  │  │  └─────────────────────────┘ │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Key API Availability

Both APIs are confirmed available in the current dependency versions:

| API                           | Package                          | Status                              |
| ----------------------------- | -------------------------------- | ----------------------------------- |
| `createVirtualizer`           | `@tanstack/solid-virtual`        | Not installed yet — needs `bun add` |
| `useElementScrollRestoration` | `@tanstack/solid-router@1.166.2` | Exported, not used yet              |

**Note:** The Solid adapter uses `createVirtualizer` (not `useVirtualizer` which is React-specific).

## Implementation Plan

### Step 1: Install `@tanstack/solid-virtual`

```bash
bun add @tanstack/solid-virtual --cwd apps/web
```

### Step 2: Remove `.limit()` from list queries

The queries currently use `.limit(visibleCount())`. With virtualization, we query **all matching articles** and let the virtualizer handle what to render.

```diff
  // _frame.inbox.index.tsx
  const articlesQuery = useLiveQuery((q) => {
    let query = q
      .from({ article: articlesCollection })
      .where(({ article }) => eq(article.isArchived, false));

    const filter = readStatusFilter(readStatus(), sessionReadIds());
    if (filter) {
      query = query.where(({ article }) => filter(article));
    }

    const direction = sortOrder() === 'oldest' ? 'asc' : 'desc';
-   return query.orderBy(({ article }) => article.pubDate, direction).limit(visibleCount());
+   return query.orderBy(({ article }) => article.pubDate, direction);
  });
```

Remove `visibleCount` signal, `handleLoadMore`, `ARTICLES_PER_PAGE` import, and the separate `totalCountQuery` (no longer needed — total count is just `articles.length`).

Repeat for all three routes.

### Step 3: Create `VirtualArticleList` component

New component replacing `ArticleList` (or refactoring it). This is the core change.

#### Scroll container choice: Window vs. Element

Two options for the scroll container:

**Option 1: Element scroller (dedicated scroll container)**

- Virtualizer scrolls inside a `<div>` with fixed height and `overflow-y: auto`
- Uses `createVirtualizer` + `getScrollElement`
- Scroll restoration via `useElementScrollRestoration` + `data-scroll-restoration-id`
- Simpler to reason about — virtualizer controls its own scroll

**Option 2: Window scroller**

- Virtualizer uses `window` as the scroll element
- Uses `createWindowVirtualizer` (Solid equivalent of `useWindowVirtualizer`)
- Needs `scrollMargin` to account for header/toolbar above the list
- Works with existing `scrollRestoration: true` on the router (no `useElementScrollRestoration` needed)
- Feels more natural — page scrolls as a whole

**Recommendation: Option 1 (element scroller).** The page has a fixed header + toolbar above the list. An element scroller avoids `scrollMargin` complexity and gives us explicit control via `useElementScrollRestoration`. The existing `scrollRestoration: true` on the router won't interfere — it handles `window` scroll, the virtualizer handles its container.

#### Component sketch

```tsx
// components/VirtualArticleList.tsx
import type { Article, Feed, Tag } from '@repo/domain/client';
import { useElementScrollRestoration } from '@tanstack/solid-router';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { For, Show } from 'solid-js';
import { ArticleCard } from './ArticleCard';

interface VirtualArticleListProps {
  articles: Article[];
  feeds: Feed[];
  tags: Tag[];
  onUpdateArticle: (articleId: string, updates: { isRead?: boolean; isArchived?: boolean }) => void;
  scrollRestorationId: string; // unique per route: 'inbox', 'feed:${id}', 'tag:${id}'
}

export function VirtualArticleList(props: VirtualArticleListProps) {
  // 1. Get saved scroll position from router
  const scrollEntry = useElementScrollRestoration({
    id: props.scrollRestorationId,
  });

  // 2. Set up scroll container ref
  let parentRef!: HTMLDivElement;

  // 3. Create virtualizer with dynamic measurement
  const virtualizer = createVirtualizer({
    get count() {
      return props.articles.length;
    },
    getScrollElement: () => parentRef,
    estimateSize: () => 160, // rough average card height in px
    overscan: 3, // render 3 extra items above/below viewport
    initialOffset: scrollEntry?.scrollY, // restore scroll on remount
  });

  return (
    <Show when={props.articles.length > 0} fallback={/* empty state */}>
      {/* Scroll container — must have fixed height + overflow */}
      <div
        ref={parentRef}
        data-scroll-restoration-id={props.scrollRestorationId}
        class="overflow-y-auto"
        style={{ height: 'calc(100vh - <toolbar-offset>px)' }}
      >
        {/* Spacer div — total height of all items */}
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Only visible items rendered */}
          <For each={virtualizer.getVirtualItems()}>
            {(virtualRow) => (
              <div
                data-index={virtualRow.index}
                ref={(el) => {
                  // Dynamic measurement — measures actual DOM height
                  queueMicrotask(() => virtualizer.measureElement(el));
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <ArticleCard
                  article={props.articles[virtualRow.index]}
                  feeds={props.feeds}
                  tags={props.tags}
                  onUpdateArticle={props.onUpdateArticle}
                />
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}
```

#### Key details

**`estimateSize`**: Set to ~160px as a starting estimate. The virtualizer needs this to calculate total scroll height before items are measured. Doesn't need to be exact — `measureElement` corrects it after render.

**`measureElement`**: Called via `ref` callback on each virtual item's wrapper `div`. The virtualizer uses `ResizeObserver` internally to track actual heights. This handles variable-height cards (with/without thumbnails, tags, long titles).

**`overscan: 3`**: Renders 3 extra items above and below the visible area. Prevents blank flashes during fast scrolling. Can be tuned — higher values = smoother scroll but more DOM nodes.

**`initialOffset`**: Restores scroll position from `useElementScrollRestoration`. On first visit, `scrollEntry` is `undefined` so offset defaults to 0.

**`data-scroll-restoration-id`**: Required attribute on the scroll container for TanStack Router to track this element's scroll position.

### Step 4: Update route components

Each route replaces `ArticleList` with `VirtualArticleList` and removes pagination state.

```diff
  // _frame.inbox.index.tsx
- import { ArticleList, ARTICLES_PER_PAGE } from '~/components/ArticleList';
+ import { VirtualArticleList } from '~/components/VirtualArticleList';

  function Inbox() {
-   const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);
    // ... queries without .limit() ...
-   const handleLoadMore = () => setVisibleCount(prev => prev + ARTICLES_PER_PAGE);

    return (
-     <ArticleList
-       articles={filteredArticles()}
-       feeds={feedsQuery()!}
-       tags={tagsQuery()!}
-       totalCount={totalCount()}
-       onLoadMore={handleLoadMore}
-       onUpdateArticle={handleUpdateArticle}
-     />
+     <VirtualArticleList
+       articles={filteredArticles()}
+       feeds={feedsQuery()!}
+       tags={tagsQuery()!}
+       onUpdateArticle={handleUpdateArticle}
+       scrollRestorationId="inbox"
+     />
    );
  }
```

For feed/tag routes, use unique IDs:

- Feed: `scrollRestorationId={`feed:${feedId}`}`
- Tag: `scrollRestorationId={`tag:${tagId}`}`

### Step 5: Handle the scroll container height

The virtualizer needs a scroll container with a fixed/constrained height. The current layout has:

```
┌─ viewport ──────────────────────┐
│ ┌─ PageLayout ────────────────┐ │
│ │ Title bar                   │ │
│ │ Description text            │ │
│ │ Toolbar (filters, sort)     │ │
│ │ ┌─ Article list ──────────┐ │ │
│ │ │ (needs to fill rest)    │ │ │
│ │ └─────────────────────────┘ │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

Options for sizing the scroll container:

1. **CSS `calc(100vh - Npx)`** — fragile if header height changes
2. **CSS `flex: 1` + `min-h-0` + `overflow-y: auto`** — flexbox fills remaining space (recommended)
3. **`ResizeObserver`** — measure dynamically

**Recommended:** Make the `PageLayout` content area a flex column. The list container gets `flex: 1; min-height: 0; overflow-y: auto`. This naturally fills the remaining viewport height.

Alternatively, consider the **window scroller** approach if the flex layout proves complex. With `createWindowVirtualizer`, the page scrolls naturally and you use `scrollMargin` to offset the header/toolbar. This avoids the fixed-height container issue entirely but requires calculating the scroll margin.

### Step 6: Handle empty state and contextual UI

`ArticleList` currently handles empty states (all caught up, no articles, etc.). Move this logic to the route level or keep it in `VirtualArticleList` as a `fallback` in a `<Show>` wrapper. The empty state doesn't need virtualization.

The `ArticleListToolbar` stays outside the virtualized area — it's part of the page layout, not the scrollable list.

## Design Decisions

### Remove "Load More" entirely?

**Yes.** With virtualization, all articles are queried (from local TanStack Solid DB — no network cost) and the virtualizer renders only what's visible. The "Load More" button becomes unnecessary.

This is safe because the data source is local-first (Electric SQL synced to client). There's no pagination API to hit — the query runs against the local collection.

### What about very large article counts?

TanStack Solid DB queries run against an in-memory collection. For a typical user (hundreds to low thousands of articles per view), querying without `.limit()` is fine. If performance becomes an issue:

1. Keep a generous `.limit()` (e.g., 500) as a safety cap
2. Add an "end of list" sentinel that loads more into the query
3. This is a future concern — virtualization solves the immediate problem

### Scroll restoration key strategy

Use route-specific keys to avoid scroll position bleeding between views:

| Route                   | `scrollRestorationId` |
| ----------------------- | --------------------- |
| `/inbox`                | `inbox`               |
| `/feeds/$feedId`        | `feed:${feedId}`      |
| `/tags/$tagId/articles` | `tag:${tagId}`        |

TanStack Router caches scroll positions by `(historyKey, elementId)`. Different feeds/tags get independent scroll positions. Navigating from feed A to feed B won't restore feed A's scroll position on feed B.

### What about the divide-y styling?

Current `ArticleList` uses `divide-base-300 divide-y` on the container. With virtualization, items are absolutely positioned, so CSS `divide-y` (which uses `border-top` on adjacent siblings) won't work.

**Fix:** Apply bottom border directly to each `ArticleCard` or its virtual wrapper:

```tsx
<div class="border-b border-base-300" style={{ /* virtual positioning */ }}>
  <ArticleCard ... />
</div>
```

### ArticleTagManager per-card live query concern

Each `ArticleCard` with tags runs a `useLiveQuery` for its article-tag relationships. With virtualization, only ~10-15 of these are active at once (vs. 20-100 currently). This is a **net improvement** — virtualization naturally throttles the number of concurrent live queries.

However, there may be setup/teardown overhead as items scroll in and out. If this causes jank, consider:

1. Lifting the article-tags query to the list level (one query, filter per card)
2. Memoizing the tag manager component
3. Using `createMemo` instead of `useLiveQuery` per card

This is an optimization to monitor, not a blocker.

## Edge Cases

- **Filter/sort change**: Changing `readStatus` or `sort` changes the query results reactively. The virtualizer's `count` updates, it re-renders, and scroll resets to top (expected behavior — new view = new scroll position).
- **Article marked as read while scrolled**: Session-read tracking keeps it visible. No scroll jump.
- **Article archived while scrolled**: Item removed from query results. Virtualizer count decreases, positions recalculate. May cause a small visual shift — acceptable.
- **Resize**: `ResizeObserver` in the virtualizer handles viewport resize automatically. `measureElement` re-measures items.
- **Images loading late**: Card height changes after image load. `measureElement` + `ResizeObserver` handles this — the virtualizer adjusts positions when a card's height changes.
- **Browser back + forward**: `useElementScrollRestoration` handles both directions. Scroll position is cached per history entry.
- **Deep-linking**: Opening `/inbox` directly has no saved scroll position → starts at top. Expected.

## Performance Expectations

| Metric                     | Before (20 items) | Before (80 items) | After (virtualized) |
| -------------------------- | ----------------- | ----------------- | ------------------- |
| DOM nodes                  | ~600              | ~2400             | ~450 (fixed)        |
| Live queries (tag manager) | 20                | 80                | ~15 (fixed)         |
| Reactive timers (TimeAgo)  | 20                | 80                | ~15 (fixed)         |
| Initial render time        | Moderate          | Slow              | Fast (fixed)        |
| Scroll restoration         | Broken            | Broken            | Works               |

## Files to Change

| File                                | Change                                                               |
| ----------------------------------- | -------------------------------------------------------------------- |
| `apps/web/package.json`             | Add `@tanstack/solid-virtual` dependency                             |
| `components/VirtualArticleList.tsx` | New component (or refactor `ArticleList.tsx`)                        |
| `components/ArticleList.tsx`        | Keep for empty states or remove/merge                                |
| `_frame.inbox.index.tsx`            | Remove `visibleCount`, remove `.limit()`, use `VirtualArticleList`   |
| `_frame.feeds.$feedId.index.tsx`    | Same                                                                 |
| `_frame.tags.$tagId.articles.tsx`   | Same                                                                 |
| `components/ArticleCard.tsx`        | Add bottom border (replace `divide-y`), possibly minor layout tweaks |
| `components/PageLayout.tsx`         | May need flex layout adjustment for scroll container height          |

## Testing Checklist

- [ ] Inbox: scroll down, click article, press back → same scroll position
- [ ] Feed view: same test
- [ ] Tag view: same test
- [ ] Switch read status filter → scroll resets to top
- [ ] Switch sort order → scroll resets to top
- [ ] Archive article mid-list → no major scroll jump
- [ ] Cards with YouTube thumbnails render correctly in virtual list
- [ ] Cards without thumbnails (shorter) measure correctly
- [ ] Fast scrolling → no blank gaps (adjust `overscan` if needed)
- [ ] Empty state still renders correctly
- [ ] Toolbar stays fixed/visible above the virtual list
- [ ] Mobile viewport works (card heights may differ)
- [ ] Browser resize doesn't break layout
