# Unified Discover Page

**Date:** February 21, 2026
**Status:** Planned

## Overview

Replace the separate AddFeedModal and SaveArticleModal with a single full `/discover` page inside the `_frame` layout. Users paste any link, the system auto-detects whether it has feeds (follow the source) or is just an article (save it). No RSS/Atom jargon exposed to the user.

## Problem Statement

The current flow has several issues:

- **Two separate modals** for adding feeds and saving articles -- users need to know the difference upfront
- **RSS-specific language** ("Website or RSS Feed URL", RSS/Atom type badges) alienates non-technical users
- **Cramped modal UI** -- the discovery flow with multi-feed results, tag selection, and error states doesn't fit well in a small dialog
- **No discoverability** -- new users with no feeds see an empty page with no guidance on what to follow
- **No content suggestions** -- users must already know URLs to add, there's no browsing or exploration

## Design Principles

- **No jargon.** Never say "RSS", "Atom", "feed URL", or "syndication". Use "feed" (consistent with the app name OpenFeeds) but never "RSS feed"
- **One entry point.** A single input field that accepts any URL. The system figures out what to do with it
- **Auto-detect.** Paste a link, get smart results. Feeds found? Offer to follow. No feeds? Offer to save the article. Both? Show both options
- **Progressive disclosure.** Start simple (paste a link), reveal complexity only when relevant (tag assignment, multiple feeds)

## Terminology

| Before                  | After                           |
| ----------------------- | ------------------------------- |
| RSS Feed / Atom Feed    | Feed                            |
| Source                  | Feed (or just the website name) |
| Subscribe               | Follow                          |
| Website or RSS Feed URL | Paste any link...               |
| Discover (action)       | Add Content / Discover          |

## Page Structure

```
/discover (inside _frame layout)
├── Header: "Discover"
├── URL Input Section (prominent, hero-style)
│   ├── Large input: "Paste any link..."
│   └── Submit button
├── Results Section (appears after paste, replaces/overlays suggestions)
│   ├── Feeds found: Feed cards with "Follow" buttons + tag selector
│   ├── Feeds + article: Both options visible
│   ├── No feeds: "Save as article" with preview
│   └── Loading / error states
├── Divider
├── Suggestions Section (placeholder initially, built out later)
│   ├── "Popular Feeds" heading
│   ├── Category chips (Tech, News, Science, Gaming, etc.)
│   └── Placeholder cards or "coming soon"
└── Future Sections (placeholders)
    ├── Email subscriptions
    ├── Search by topic
    └── Browse by category
```

## UX Flow

### Paste a blog/news site URL

```
User pastes "https://techcrunch.com"
  -> Loading state
  -> Discovery finds 2 feeds
  -> Shows: "We found 2 feeds from TechCrunch"
     [TechCrunch - Main Feed]    [Follow]  [Tags...]
     [TechCrunch - Startups]     [Follow]  [Tags...]
  -> Secondary: "Or save this page as an article"
```

### Paste a direct article URL

```
User pastes "https://example.com/great-article-about-ai"
  -> Loading state
  -> Discovery finds 0 feeds (or finds feeds from the parent site)
  -> If feeds found: shows feeds + "Save this article" option
  -> If no feeds: "Save this article" with preview card
     [Article title / URL preview]  [Save Article]
```

### Paste a known service URL

```
User pastes "https://youtube.com/c/SomeChannel"
  -> Loading state
  -> Discovery recognizes YouTube, returns channel feed
  -> Shows: "Follow SomeChannel on YouTube"
     [SomeChannel]  [Follow]
```

## Technical Implementation

### Files to Create

| File                                      | Description       |
| ----------------------------------------- | ----------------- |
| `apps/web/src/routes/_frame.discover.tsx` | New discover page |

### Files to Modify

| File                                         | Change                                                           |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `apps/web/src/routes/_frame.tsx`             | Replace modal sidebar buttons with `/discover` nav link          |
| `apps/web/src/routes/_frame.feeds.index.tsx` | Remove AddFeedModal refs, "Add Feed" -> navigate to `/discover`  |
| `apps/web/src/routes/index.tsx`              | New users (no feeds) redirect to `/discover` instead of `/feeds` |

### Files to Delete

| File                                           | Reason                    |
| ---------------------------------------------- | ------------------------- |
| `apps/web/src/components/AddFeedModal.tsx`     | Replaced by discover page |
| `apps/web/src/components/SaveArticleModal.tsx` | Replaced by discover page |

### No Backend Changes

The existing server functions are reused as-is:

- `$$discoverFeeds` -- feed discovery from URL
- `$$createFeeds` / `feedsCollection.insert` -- adding feeds (local-first)
- `$$createArticle` / `articlesCollection.insert` -- saving articles (local-first)
- `MultiSelectTag` component -- tag assignment

### Auto-Detect Logic (Client-Side)

```
1. User submits URL
2. Call $$discoverFeeds(url)
3. If feeds found:
   a. Display feed cards with "Follow" button each
   b. Also show "Save this page as an article" as secondary action
4. If no feeds found:
   a. Show "No feeds found for this site"
   b. Offer "Save as article" as primary action
   c. Offer "Add URL directly as feed" as secondary/advanced action
5. On "Follow": insert into feedsCollection (same as current AddFeedModal.handleAddFeed)
6. On "Save Article": insert into articlesCollection with feedId: null
```

## Sidebar Navigation

The `/discover` link should be prominent -- either above the main nav items or styled as a special action button. The exact styling is TBD, but it replaces both the "Discover" and "Save Article" sidebar buttons.

## Future Improvements

These are not in scope for the initial implementation but should be kept in mind for the page layout. Leave visual placeholders where appropriate.

### Curated Feed Suggestions

Pre-populated feed recommendations users can one-click follow. Data sources:

- **[awesome-rss-feeds](https://github.com/plenaryapp/awesome-rss-feeds)** (CC0 license) -- ~500 curated feeds across 30+ categories (Tech, News, Science, Gaming, Food, etc.) + country-based local news. Includes OPML files ready for import
- **[Folo](https://github.com/RSSNext/Folo)** -- has a discover/search API that searches across their user base for popular feeds. Could inspire our own trending/popular system
- **Feedly categories** -- Feedly's explore page organizes feeds by topic. Good UX reference for category browsing
- Could be implemented as a static JSON shipped with the app initially, later as a server-side curated collection

### Email Subscriptions

Allow users to subscribe to email newsletters that get delivered into OpenFeeds as articles. Would require:

- A unique email address per user (e.g., `user123@feeds.openfeeds.app`)
- An email ingestion service that converts incoming emails to articles
- UI on the discover page: "Get an email address to subscribe to newsletters"

### RSSHub Integration

[RSSHub](https://docs.rsshub.app/) is an open-source RSS feed generator that creates feeds for sites that don't natively support RSS (social media, forums, etc.). Integration options:

- **Transparent backend use:** When discovery finds no feeds, silently check RSSHub routes for the domain. If a route exists, offer it as a feed option. User never sees "RSSHub" branding
- **Self-hosted instance:** Run our own RSSHub instance for reliability. The discovery package could check our RSSHub before falling back to common paths
- **Radar rules:** RSSHub has a "Radar" system that maps website URLs to RSSHub routes. We could integrate these rules into our discovery package to dramatically expand the number of sites we can generate feeds for
- **npm package:** RSSHub can be used as an npm package (`rsshub`) directly in our worker, avoiding the need for a separate service
- Folo already integrates RSSHub natively (supports `rsshub://` protocol prefix). We can learn from their approach but keep it invisible to users

### Search by Topic/Keyword

Instead of requiring a URL, let users search "machine learning" or "cooking" and see relevant feeds. Could use:

- Our own index of discovered feeds
- Integration with feed directories
- RSSHub's route catalog (which covers thousands of sites)

### Feed43 / DIY Feed Generation

[Feed43](https://feed43.com/) and similar services let users create RSS feeds from any webpage by defining extraction rules. Could be exposed as an advanced feature: "This site doesn't have a feed. Create one?" -- but this is complex and low priority.

### Import from Other Readers

Beyond the existing OPML import, could support one-click import from:

- Feedly (API export)
- Inoreader (API export)
- Pocket (saved articles)
- Browser bookmarks

### Social/Community Features

Inspired by Folo's community approach:

- Shareable feed lists ("My favorite tech feeds")
- Public collections curated by the OpenFeeds team
- "X people follow this feed" social proof in discovery results
