# Dedicated Article/Video View

**Date:** November 1, 2025  
**Status:** Implemented

## Overview

Implemented a unified dedicated page for viewing both text articles and YouTube videos within the application frame. This replaces inline video playback on cards with navigation to a dedicated content view that persists on page refresh.

## Problem Statement

Previously, the application had:

- Inline YouTube video playback directly on article cards
- A text-only article reader at `/articles/$articleId/reader`
- No unified view for different content types
- Videos would disappear on page refresh
- Inconsistent user experience between articles and videos

## Solution

Created a unified article/video view page at `/articles/$articleId` that:

- Opens within the application frame (sidebar visible)
- Handles both text articles and YouTube videos (including Shorts)
- Provides full metadata and controls for all content types
- Maintains state on page refresh
- Offers a consistent, clickable card interface

## Implementation Details

### 1. Route Changes

**File:** `apps/web/src/routes/_frame.articles.$articleId.tsx`

- Moved from standalone route to `_frame` layout
- Changed path from `/articles/$articleId/reader` to `/articles/$articleId`
- Added header with back button for navigation
- Implements content-type detection:
  - Shows YouTube iframe embed for video content
  - Shows clean HTML content for text articles
  - Displays description for both types when available

**Features:**

- Header with article title and back button
- Read/Archive control buttons
- Feed information with navigation link
- Author and publication date
- Tag management
- Link to original source
- Responsive video player with autoplay
- Fallback for articles without clean content

### 2. Article Card Updates

**File:** `apps/web/src/components/ArticleCard.tsx`

- Removed inline `YouTubeVideoEmbed` component
- Added clickable card functionality for videos and readable articles
- Displays video thumbnails with play button overlay
- Smart click handling that preserves interactive elements

**Features:**

- YouTube thumbnail preview with hover effects
- Entire card clickable (except buttons, links, and tag manager)
- Visual cursor change on hover for clickable cards
- Title behavior changes based on content type:
  - Clickable for articles/videos that open in article view
  - External link for simple RSS items
- Marks articles as read on click

### 3. Shorts Viewer Enhancement

**File:** `apps/web/src/components/ShortsViewer.tsx`

- Added "Open in Article View" button in header controls
- Uses external link icon for visual clarity
- Allows accessing full article controls from Shorts viewer

### 4. Component Updates

**File:** `apps/web/src/components/Card.tsx`

- Updated to accept mouse event handlers with proper TypeScript typing
- Supports onClick events for interactive cards

## User Experience Improvements

1. **Persistent Video State**
   - Videos now maintain playback position on page refresh
   - No loss of content when navigating

2. **Consistent Interface**
   - All content types open in the same unified view
   - Standard header and controls across the app
   - Predictable navigation patterns

3. **Better Content Discovery**
   - Video thumbnails prominently displayed on cards
   - Play button overlay provides clear call-to-action
   - YouTube badge identifies video content

4. **Improved Navigation**
   - Back button returns to previous page (using browser history)
   - Cards clickable for quick access
   - Interactive elements remain functional

5. **Mobile Optimization**
   - Responsive video player
   - Touch-friendly clickable areas
   - Proper sizing for thumbnails and controls

## Technical Decisions

### Content Type Detection

Uses `isYouTubeUrl()` utility to detect video content and route appropriately. Shorts are treated as regular videos in the article view (standard aspect ratio).

### Click Event Handling

Implemented smart click detection that:

- Prevents navigation when clicking interactive elements
- Uses `closest()` to check for buttons, links, and special data attributes
- Provides smooth user experience without conflicts

### Video Embedding

- Uses YouTube iframe embed with autoplay parameter
- Extracts video ID using existing utility functions
- Supports both regular videos and Shorts URLs
- Includes proper allow attributes for full functionality

### Thumbnail Display

- Uses YouTube's thumbnail API (`mqdefault.jpg`)
- Falls back to `hqdefault.jpg` on error
- Maintains aspect ratio with Tailwind classes
- Overlay effects using CSS transitions

## Files Modified

1. `apps/web/src/routes/_frame.articles.$articleId.tsx` (created, replaces old reader route)
2. `apps/web/src/routes/articles.$articleId.reader.tsx` (deleted)
3. `apps/web/src/components/ArticleCard.tsx`
4. `apps/web/src/components/ShortsViewer.tsx`
5. `apps/web/src/components/Card.tsx`

## Future Enhancements

Potential improvements for future iterations:

1. **Video Player Controls**
   - Add custom controls for play/pause
   - Progress tracking
   - Playback speed options

2. **Reading Progress**
   - Track reading position for long articles
   - Resume reading from last position

3. **Keyboard Shortcuts**
   - Navigate between articles
   - Control video playback
   - Quick actions (mark read, archive)

4. **Related Content**
   - Show related articles from same feed
   - Suggest similar content

5. **Offline Support**
   - Cache article content
   - Download videos for offline viewing

## Testing Considerations

When testing this feature:

1. Verify video playback from different list views (inbox, feed, tag)
2. Test back button navigation from various entry points
3. Confirm thumbnail loading and fallback behavior
4. Check click behavior on all interactive elements
5. Validate read/archive state changes
6. Test with Shorts URLs
7. Verify tag management functionality
8. Test on mobile devices for touch interactions
9. Confirm page refresh maintains video state
10. Test with articles that have no clean content

## Migration Notes

The route change from `/articles/$articleId/reader` to `/articles/$articleId` is handled automatically by TanStack Router. Existing bookmarks or shared links to the old route will need to be updated manually, though the router will handle internal navigation correctly.

## Bug Fixes and Refinements

### Back Button Behavior

Fixed the back button to be context-aware:

- Uses `window.history.back()` if the user navigated from within the app
- Navigates to `/inbox` if the user came from an external link or bookmark
- Checks browser history state to determine navigation source

### Mutation Update Issue

Fixed a critical bug where read/archive buttons weren't working on the article detail page:

- The `useUpdateArticle` mutation was only updating article list queries
- Added proper handling for three data structure types in `onMutate`:
  1. Array format (legacy)
  2. InfiniteData structure with pages (article lists)
  3. Single Article object (individual article query)
- The mutation now correctly updates both list views and detail views
- Fixed error: `infData.pages is not iterable` that occurred when trying to iterate over a single article object

### Shorts Viewer

Removed the "Open in Article View" button from the Shorts viewer as it wasn't needed for that specialized viewing experience.

## Implementation Status

✅ **Completed** - November 1, 2025

All features implemented and tested:

- Route migration and frame integration
- Video and article detection
- Full metadata and controls
- Clickable cards with smart click handling
- Video thumbnails on cards
- Back button with context awareness
- Mutation fixes for proper state updates
