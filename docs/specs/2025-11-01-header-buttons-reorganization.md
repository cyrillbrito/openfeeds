# Header Buttons Reorganization

**Date:** November 1, 2025  
**Status:** Proposed

## Overview

Reorganize header action buttons by separating feed-level actions from list-level controls, moving list controls to a dedicated toolbar positioned above the article list.

## Problem Statement

Current header buttons have organizational issues:

- All actions grouped together despite serving different purposes
- List controls (Unread Only, Shuffle, Mark All Read) apply only to the article list but live in the global header
- In feed view, buttons control the list below feed information, creating unclear scope
- Small, numerous buttons create visual clutter
- Buttons feel disconnected from what they control

## Solution

Split actions by context using a two-tier approach:

### 1. Top Header (Sticky)

Keep only **feed-level actions**:

- **Shorts** button (navigates to different view)
- **Edit/Delete** dropdown (feed settings)

### 2. Article List Toolbar (New Component)

Create compact toolbar positioned **above the article list** with list controls:

- **Read Status Toggle** (Unread Only / All / Read)
- **Shuffle** button
- **Mark All Read** button

Position after feed information section, right before article list begins.

## Implementation

### New Component

Create `ArticleListToolbar.tsx` component that wraps list control buttons.

### Layout Structure

```
<Header> → Feed-level actions only
<FeedInfoSection> → Feed icon, description, tags
<ArticleListToolbar> → List controls (NEW)
<ArticleList> → Articles
```

### Files to Modify

- `apps/web/src/components/ArticleListToolbar.tsx` (create)
- `apps/web/src/routes/_frame.feeds.$feedId.index.tsx`
- `apps/web/src/routes/_frame.tags.$tagId.tsx`
- `apps/web/src/routes/_frame.inbox.index.tsx`
- `apps/web/src/components/Header.tsx` (simplify)

## Benefits

- **Clear context**: Controls positioned where they apply
- **Visual hierarchy**: Feed info → List controls → List content
- **Reduced clutter**: Cleaner top header
- **Better UX**: Obvious scope of each action
- **Scalable**: Easy to add more list filters later

## Notes

- Toolbar can be made sticky if desired (stick below header)
- Use `btn-xs` or `btn-sm` for compact appearance
- Consider collapsible on mobile to save space
- Same toolbar component reused across inbox, feed, and tag views
