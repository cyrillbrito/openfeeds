# Archive Toast Feedback with Undo

**Date:** November 1, 2025  
**Status:** Completed

## Overview

Implement toast notifications when archiving articles to provide user feedback and allow quick undo action, with immediate list removal in the inbox view.

## Problem Statement

Currently, archiving an article provides no user feedback. Additionally, archived articles remain visible in the inbox view instead of being immediately removed from the list, despite the inbox filtering by archived status.

## Solution

Add a toast notification system that:

1. **Shows toast message** when archiving an article (e.g., "Article archived")
2. **Immediately removes article** from the list when archived in the inbox view only
3. **Includes undo button** in the toast to restore the article if archived by mistake

## Implementation Requirements

### Core Features

1. **Toast Notification**
   - Display on archive action
   - Message: "Article archived" or similar
   - Duration: 5-7 seconds (enough time to read and react)
   - Include "Undo" action button

2. **Inbox List Behavior**
   - Remove article immediately when archived (inbox view only)
   - Other views (feeds, tags, etc.) keep current behavior
   - Optimistic UI update for instant feedback

3. **Undo Functionality**
   - Clicking "Undo" in toast restores article to unarchived state
   - Article reappears in inbox list
   - Cancel pending archive mutation if not yet committed

### Technical Considerations

- Use existing mutation infrastructure (`useUpdateArticle`)
- Implement optimistic updates with rollback on error
- Use daisyUI toast component ([documentation](https://daisyui.com/components/toast/))
  - Position: `toast-bottom toast-end` (default bottom-right corner)
  - Use `alert-success` styling inside toast
  - Include action button for undo functionality
- Handle edge cases (navigation during toast, multiple archives, etc.)

## User Experience

Before: User archives article → no feedback → article stays in inbox list → confusing

After: User archives article → toast appears with "Article archived" → article disappears from inbox → user can click "Undo" if mistake

## Files to Modify

- Toast notification component (or create if doesn't exist)
- `apps/web/src/components/ArticleCard.tsx` or archive mutation handlers
- `apps/web/src/hooks/queries.ts` (update mutation for optimistic updates)
- Inbox view component to handle list updates

## Notes

- Only remove from list in **inbox view** (filtered by archived status)
- Other views don't filter by archive status, so keep current behavior
- Fast feedback is critical since the article disappears immediately
