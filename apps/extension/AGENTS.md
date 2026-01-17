# Browser Extension - WXT + SolidJS

## Overview

Chrome/Firefox extension that detects RSS/Atom feeds on any webpage and allows users to subscribe via OpenFeeds.

## Tech Stack

- **Framework:** WXT (Web Extension Tools)
- **UI:** SolidJS + Tailwind v4 + DaisyUI
- **Build:** Vite

## Commands

```bash
bun dev          # Start dev mode (port 3003)
bun dev:firefox  # Dev mode for Firefox
bun build        # Production build for Chrome
bun build:firefox
bun zip          # Create distributable ZIP
```

## Architecture

### Entrypoints

| File                        | Type           | Purpose                                         |
| --------------------------- | -------------- | ----------------------------------------------- |
| `entrypoints/popup/`        | Popup UI       | SolidJS app shown when clicking extension icon  |
| `entrypoints/content.ts`    | Content Script | Injected into all pages, detects feeds from DOM |
| `entrypoints/background.ts` | Service Worker | Handles API calls to OpenFeeds server           |

### Message Flow

```
User clicks extension icon
           │
           ▼
┌──────────────────────────────────────────────────────────────┐
│  POPUP (App.tsx)                                             │
│  - Queries active tab                                        │
│  - Sends GET_FEEDS to content script                         │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ browser.tabs.sendMessage(tabId, { type: "GET_FEEDS" })
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  CONTENT SCRIPT (content.ts)                                 │
│  - Already injected at document_idle on ALL pages            │
│  - Listens for GET_FEEDS message                             │
│  - Runs detectFeedsFromPage() to scan DOM                    │
│  - Returns FEEDS_RESULT with discovered feeds                │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ { type: "FEEDS_RESULT", feeds: [...] }
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  POPUP displays feeds                                        │
│  User clicks "Follow" button                                 │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ browser.runtime.sendMessage({ type: "FOLLOW_FEED", feed })
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  BACKGROUND (background.ts)                                  │
│  - Receives FOLLOW_FEED message                              │
│  - POSTs to OpenFeeds API: /api/feeds                        │
│  - Returns FOLLOW_RESULT (success/error)                     │
└──────────────────────────────────────────────────────────────┘
```

## Message Types

Defined in `utils/types.ts`:

| Message         | Direction          | Purpose                 |
| --------------- | ------------------ | ----------------------- |
| `GET_FEEDS`     | Popup → Content    | Request feed detection  |
| `FEEDS_RESULT`  | Content → Popup    | Return discovered feeds |
| `FOLLOW_FEED`   | Popup → Background | Subscribe to a feed     |
| `FOLLOW_RESULT` | Background → Popup | Subscription result     |

## Feed Detection

`utils/feed-detector.ts` scans the page using two methods:

1. **`<link rel="alternate">`** - Standard RSS/Atom autodiscovery
   - Checks for feed MIME types: `application/rss+xml`, `application/atom+xml`, etc.

2. **`<a>` tags heuristics** - Fallback for pages without proper autodiscovery
   - Looks for URLs containing `/feed`, `/rss`, `/atom`
   - Looks for link text containing "rss", "feed", "subscribe"
   - Marked as `type: "potential"` (less certain)

## Configuration

### Storage

- `apiUrl` - OpenFeeds API URL (default: `http://localhost:3001`)

### Manifest Permissions

- `activeTab` - Access current tab to inject content script
- `storage` - Store API URL preference
- `host_permissions` - Allow API calls to localhost and openfeeds.com

## Directory Structure

```
apps/extension/
├── entrypoints/
│   ├── popup/           # SolidJS popup UI
│   │   ├── App.tsx      # Main component
│   │   ├── App.css      # Tailwind entry
│   │   ├── main.tsx     # Mount point
│   │   └── index.html
│   ├── content.ts       # Content script (feed detection)
│   └── background.ts    # Service worker (API calls)
├── utils/
│   ├── types.ts         # Message types, interfaces
│   └── feed-detector.ts # DOM scanning logic
├── wxt.config.ts        # WXT configuration
└── tsconfig.json
```

## Development Notes

- Content script runs on ALL URLs (`<all_urls>`) at `document_idle`
- Popup communicates with content script via `browser.tabs.sendMessage()`
- Background script uses `fetch()` with `credentials: 'include'` for auth cookies
- Dev server runs on port 3003 to avoid conflicts with web app (3000) and API (3001)
