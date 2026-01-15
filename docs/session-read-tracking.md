# Session-Read Article Tracking

## Problem

Marking an article as read in "Unread" view instantly removes it (TanStack DB reactive filtering). Jarring UX.

## Solution

Track IDs marked as read during session. Show: `isUnread OR inSessionReadIds`. Resets on navigation to different list view or page refresh.

## Implementation

### Context: `useSessionRead()`

```typescript
const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();
```

### Per-View Tracking

Each view has isolated tracking. Changing view key resets the set.

| Route            | View Key                                |
| ---------------- | --------------------------------------- |
| `/inbox`         | `inbox`                                 |
| `/feeds/$feedId` | `feed:${feedId}`                        |
| `/tags/$tagId`   | `tag:${tagId}`                          |
| Shorts variants  | `inbox-shorts`, `feed-shorts:${feedId}` |

### Route Pattern

```typescript
// 1. Set view key on mount
onMount(() => setViewKey('inbox'));

// 2. Client-side filter (don't push isRead to server for "unread")
const articles = () => {
  const all = articlesQuery.data || [];
  if (readStatus() !== 'unread') return all;
  return all.filter((a) => !a.isRead || sessionReadIds().has(a.id));
};

// 3. Track on mark-as-read
if (updates.isRead === true) addSessionRead(articleId);
```
