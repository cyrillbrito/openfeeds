# End-to-End Testing Plan

**Date:** January 2025  
**Status:** Planning

## Overview

This document outlines a comprehensive end-to-end testing plan for OpenFeeds. The plan is organized by application sections and features, providing a high-level structure for test coverage.

## Current Test Coverage

### ✅ Implemented

- **Authentication:** Sign in, sign up flows
- **Tags Management:** Full CRUD operations
- **OPML Import:** Import functionality with categories

### ⏳ Pending

- Feed management (add, edit, delete individual feeds)
- Article reading experience
- Inbox and feed views
- Article actions (read/unread, archive)
- Shorts view
- Settings
- Navigation and drawer
- Search functionality

---

## Test Sections

### 1. Authentication & Authorization

**Scope:** User authentication flows and protected route access

**Test Areas:**

- Sign up flow (validation, success, error handling)
- Sign in flow (validation, success, error handling)
- Password reset/forgot password flow
- Session persistence and refresh
- Protected route access (redirects when unauthenticated)
- Logout functionality
- Redirect handling after authentication

**Current Status:** ✅ Partially implemented (sign in/sign up basic flows)

---

### 2. Feed Management

**Scope:** Adding, editing, deleting, and organizing RSS feeds

**Test Areas:**

- **Add Feed:**
  - Add feed by URL (valid RSS/Atom feeds)
  - Add feed with invalid URL
  - Add feed with non-RSS URL
  - Add duplicate feed
  - Feed discovery and validation
  - Loading states during feed addition
- **Feed List:**
  - Display feeds in grid/list view
  - Empty state when no feeds exist
  - Feed card information (title, description, article count)
  - Feed search/filtering
  - Feed sorting options
- **Edit Feed:**
  - Edit feed title
  - Edit feed description
  - Update feed tags
  - Save changes
  - Cancel editing
- **Delete Feed:**
  - Delete feed with confirmation
  - Cancel deletion
  - Delete feed with articles (verify cascade behavior)
- **OPML Import:**
  - Import valid OPML file
  - Import OPML with categories (creates tags)
  - Import invalid OPML file
  - Import from empty state
  - Cancel import
  - Progress indication during import
- **OPML Export:**
  - Export all feeds to OPML
  - Export with tags/categories
  - Verify exported file structure

**Current Status:** ⏳ Partially implemented (OPML import only)

---

### 3. Tags Management

**Scope:** Creating, editing, deleting, and organizing tags

**Test Areas:**

- Create tag (name, color selection)
- Edit tag (name, color)
- Delete tag (with confirmation)
- Tag list display (empty state, grid view)
- Tag search/filtering
- Duplicate tag name validation
- Tag color selection
- Tag assignment to articles
- Tag assignment to feeds

**Current Status:** ✅ Fully implemented

---

### 4. Inbox View

**Scope:** Unified article list showing all unread articles across feeds

**Test Areas:**

- **Article List:**
  - Display articles from all feeds
  - Empty state when no articles
  - Article card information (title, feed, date, read status)
  - Pagination/infinite scroll
  - Article count display
- **Read Status Filtering:**
  - Filter by unread only
  - Filter by all articles
  - Filter by read only
  - URL parameter persistence
- **Article Actions:**
  - Mark article as read/unread
  - Archive article
  - Tag article
  - Navigate to article detail
- **List Controls:**
  - Shuffle articles
  - Mark all as read (with confirmation)
  - Read status toggle
  - Toolbar visibility and functionality

**Current Status:** ⏳ Not implemented

---

### 5. Feed-Specific Views

**Scope:** Viewing articles from a specific feed

**Test Areas:**

- **Feed Detail Page:**
  - Display feed information (title, description, URL)
  - Display feed tags
  - Article list for specific feed
  - Empty state when feed has no articles
  - Article count per feed
- **Read Status Filtering:**
  - Filter articles by read status within feed
  - URL parameter persistence
- **Article Actions:**
  - Mark article as read/unread
  - Archive article
  - Tag article
  - Navigate to article detail
- **Feed Actions:**
  - Edit feed (from feed view)
  - Delete feed (from feed view)
  - Navigate to shorts view
- **List Controls:**
  - Shuffle articles
  - Mark all as read (feed-specific)
  - Read status toggle

**Current Status:** ⏳ Not implemented

---

### 6. Tag-Specific Views

**Scope:** Viewing articles filtered by tag

**Test Areas:**

- Display articles with specific tag
- Empty state when tag has no articles
- Article count per tag
- Read status filtering within tag view
- Article actions (read/unread, archive, tag management)
- List controls (shuffle, mark all read)
- Navigate to tag management

**Current Status:** ⏳ Not implemented

---

### 7. Article Detail View

**Scope:** Reading individual articles with full content

**Test Areas:**

- **Article Display:**
  - Article title and metadata
  - Article content/readability extraction
  - Feed information and link
  - Publication date
  - Article URL and external link
- **YouTube Integration:**
  - Detect YouTube video URLs
  - Display YouTube video embed
  - Detect YouTube shorts
  - Video autoplay behavior
- **Article Actions:**
  - Mark as read/unread
  - Archive article
  - Tag article (add/remove tags)
  - Navigate back to list
  - Open article in new tab
- **Navigation:**
  - Previous/next article navigation
  - Keyboard shortcuts
  - Breadcrumb navigation

**Current Status:** ⏳ Not implemented

---

### 8. Shorts View

**Scope:** Viewing YouTube shorts and short-form content

**Test Areas:**

- **Inbox Shorts:**
  - Display all shorts from all feeds
  - Empty state
  - Shorts detection and filtering
  - Read status filtering
- **Feed Shorts:**
  - Display shorts from specific feed
  - Empty state
  - Feed information display
- **Shorts Display:**
  - Video embed for shorts
  - Article metadata
  - Article actions (read/unread, archive, tag)
  - Navigation between shorts

**Current Status:** ⏳ Not implemented

---

### 9. Navigation & Layout

**Scope:** Application navigation, drawer, and layout components

**Test Areas:**

- **Drawer Navigation:**
  - Open/close drawer
  - Navigate to Inbox
  - Navigate to Feeds
  - Navigate to Tags
  - Navigate to Settings
  - Display user information
  - Logout from drawer
- **Header:**
  - Header visibility across pages
  - Header actions (context-specific)
  - Responsive behavior
- **Breadcrumbs:**
  - Breadcrumb display
  - Breadcrumb navigation
- **Responsive Design:**
  - Mobile drawer behavior
  - Tablet layout
  - Desktop layout

**Current Status:** ⏳ Not implemented

---

### 10. Search Functionality

**Scope:** Searching across feeds and articles

**Test Areas:**

- **Feed Search:**
  - Search feeds by title
  - Search feeds by description
  - Search feeds by URL
  - Clear search
  - Search results display
- **Article Search:**
  - Search articles by title
  - Search articles by content
  - Search within specific feed
  - Search within tag
  - Search results highlighting
  - Clear search

**Current Status:** ⏳ Not implemented

---

### 11. Settings

**Scope:** User settings and preferences

**Test Areas:**

- Display settings page
- User profile information
- Theme preferences (if applicable)
- Account settings
- Data export
- Account deletion (if applicable)

**Current Status:** ⏳ Not implemented

---

### 12. Article Actions & State Management

**Scope:** Actions that can be performed on articles

**Test Areas:**

- **Read Status:**
  - Toggle read/unread
  - Bulk mark as read
  - Mark all as read (with confirmation)
  - Read status persistence
  - Read status sync across views
- **Archive:**
  - Archive individual article
  - Archive with undo toast
  - Undo archive action
  - Archived articles don't appear in inbox
  - View archived articles (if applicable)
- **Tagging:**
  - Add tag to article
  - Remove tag from article
  - Multiple tags per article
  - Tag assignment from article detail
  - Tag assignment from article list

**Current Status:** ⏳ Not implemented

---

### 13. Error Handling & Edge Cases

**Scope:** Error states, network failures, and edge cases

**Test Areas:**

- **Network Errors:**
  - API request failures
  - Timeout handling
  - Retry mechanisms
  - Offline behavior
- **Validation Errors:**
  - Invalid input handling
  - Form validation
  - Error message display
- **Empty States:**
  - No feeds
  - No articles
  - No tags
  - No search results
- **Loading States:**
  - Page loading
  - Data fetching
  - Action loading (buttons, forms)
- **Edge Cases:**
  - Very long titles/descriptions
  - Special characters in content
  - Large number of feeds/articles
  - Rapid user actions

**Current Status:** ⏳ Partially implemented (some error handling in auth)

---

### 14. Data Persistence & Sync

**Scope:** Data consistency and background sync

**Test Areas:**

- Feed sync indicator
- Article count updates after sync
- Read status persistence across sessions
- Tag assignments persistence
- Archive status persistence
- Background feed updates (if visible in UI)

**Current Status:** ⏳ Not implemented

---

## Test Organization

### Test File Structure

```
apps/e2e/tests/
├── auth/
│   ├── signin.spec.ts ✅
│   ├── signup.spec.ts ✅
│   └── password-reset.spec.ts ⏳
├── feeds/
│   ├── add-feed.spec.ts ⏳
│   ├── edit-feed.spec.ts ⏳
│   ├── delete-feed.spec.ts ⏳
│   ├── feed-list.spec.ts ⏳
│   ├── import-opml.spec.ts ✅
│   └── export-opml.spec.ts ⏳
├── tags/
│   └── tags.spec.ts ✅
├── inbox/
│   ├── inbox-view.spec.ts ⏳
│   └── inbox-actions.spec.ts ⏳
├── feed-view/
│   ├── feed-detail.spec.ts ⏳
│   └── feed-articles.spec.ts ⏳
├── tag-view/
│   └── tag-articles.spec.ts ⏳
├── articles/
│   ├── article-detail.spec.ts ⏳
│   ├── article-actions.spec.ts ⏳
│   └── youtube-integration.spec.ts ⏳
├── shorts/
│   ├── inbox-shorts.spec.ts ⏳
│   └── feed-shorts.spec.ts ⏳
├── navigation/
│   ├── drawer.spec.ts ⏳
│   └── header.spec.ts ⏳
├── search/
│   ├── feed-search.spec.ts ⏳
│   └── article-search.spec.ts ⏳
├── settings/
│   └── settings.spec.ts ⏳
└── error-handling/
    ├── network-errors.spec.ts ⏳
    └── validation-errors.spec.ts ⏳
```

---

## Testing Patterns

### Page Object Model

- Continue using Page Object Model pattern
- Create page objects for each major view
- Create component objects for reusable UI elements

### Visual Regression

- Continue screenshot testing for UI consistency
- Mask sensitive data (emails, user info)
- Test responsive breakpoints

### Test Data Management

- Use dynamic test data (timestamp-based emails)
- Zero-trace testing (clean up all data)
- Mock server for RSS feeds
- Fixtures for OPML files

### Test Isolation

- Each test should be independent
- Use fixtures for authentication
- Clean up after each test

---

## Priority Levels

### High Priority (Core User Flows)

1. Feed Management (add, edit, delete)
2. Inbox View
3. Article Detail View
4. Article Actions (read/unread, archive)
5. Navigation & Drawer

### Medium Priority (Important Features)

1. Feed-Specific Views
2. Tag-Specific Views
3. Shorts View
4. Search Functionality
5. Error Handling

### Low Priority (Nice to Have)

1. Settings
2. Advanced Error Scenarios
3. Performance Testing
4. Cross-browser Testing

---

## Next Steps

1. **Phase 1:** Implement high-priority test sections
   - Feed management (add, edit, delete)
   - Inbox view
   - Article detail view
   - Basic article actions

2. **Phase 2:** Implement medium-priority test sections
   - Feed-specific and tag-specific views
   - Shorts view
   - Search functionality

3. **Phase 3:** Implement low-priority test sections
   - Settings
   - Advanced error handling
   - Edge cases

4. **Ongoing:** Maintain and update tests as features evolve

---

## Notes

- All tests should follow the existing patterns (Page Object Model, visual regression, zero-trace)
- Use the mock server for RSS feed responses
- Maintain test isolation and independence
- Keep tests focused on user-facing functionality
- Document any test-specific setup or requirements
