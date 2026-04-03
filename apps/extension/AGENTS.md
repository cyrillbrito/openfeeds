# Browser Extension - WXT + SolidJS

Chrome/Firefox extension that detects RSS/Atom feeds on any webpage and subscribes via OpenFeeds.

**Stack:** WXT, SolidJS, Tailwind v4 + DaisyUI, Vite

## Commands

```bash
bun dev          # Dev mode (port 3003)
bun dev:firefox  # Firefox dev mode
bun build        # Production build (Chrome)
bun build:firefox
bun zip          # Distributable ZIP
```

## Entrypoints

| File                        | Type           | Purpose                                        |
| --------------------------- | -------------- | ---------------------------------------------- |
| `entrypoints/popup/`        | Popup UI       | SolidJS app, sends GET_FEEDS to content script |
| `entrypoints/options/`      | Options Page   | Settings UI for configuring server URL         |
| `entrypoints/content.ts`    | Content Script | Injected on all pages, detects feeds from DOM  |
| `entrypoints/background.ts` | Service Worker | Handles API calls to OpenFeeds server          |

## Message Flow

1. Popup sends `GET_FEEDS` to content script
2. Content script runs `detectFeedsFromPage()` → returns `FEEDS_RESULT`
3. User clicks "Follow" → popup sends `FOLLOW_FEED` to background
4. Background POSTs to OpenFeeds API → returns `FOLLOW_RESULT`

All message types defined in `utils/types.ts`:

| Message         | Direction           | Purpose                 |
| --------------- | ------------------- | ----------------------- |
| `GET_FEEDS`     | Popup -> Content    | Request feed detection  |
| `FEEDS_RESULT`  | Content -> Popup    | Return discovered feeds |
| `FOLLOW_FEED`   | Popup -> Background | Subscribe to a feed     |
| `FOLLOW_RESULT` | Background -> Popup | Subscription result     |

## Feed Detection

`utils/feed-detector.ts` scans pages using:

1. **`<link rel="alternate">`** — standard RSS/Atom autodiscovery (feed MIME types)
2. **`<a>` tag heuristics** — fallback, checks URLs/text for feed-related patterns. Marked as `type: "potential"`

## Configuration

- `apiUrl` stored in extension storage (default: `https://openfeeds.app`)
- Permissions: `activeTab`, `storage`, host permissions for localhost + openfeeds.app
- Content script runs on ALL URLs at `document_idle`
- Background uses `fetch()` with `credentials: 'include'` for auth cookies
- Dev port 3003 (avoids conflict with web 3000)

## Directory Structure

```
apps/extension/
├── entrypoints/
│   ├── popup/           # SolidJS popup UI (App.tsx, main.tsx, index.html)
│   ├── options/         # Settings page (App.tsx, main.tsx, index.html)
│   ├── content.ts       # Content script (feed detection)
│   └── background.ts    # Service worker (API calls)
├── utils/
│   ├── types.ts         # Message types, interfaces
│   └── feed-detector.ts # DOM scanning logic
└── wxt.config.ts
```

## Future Ideas

### Reader Mode

Standalone reader view that renders any article in a clean, distraction-free format without requiring OpenFeeds account or saving:

- Add "Read" button in popup next to feed URLs
- Opens new tab with `/reader?url=<encoded-url>` route
- Fetches page via background script, runs Readability extraction
- Renders clean HTML in dedicated reader page with typography optimizations
- Works independently of OpenFeeds app - pure client-side reading experience

### Print Support

One-click printing of articles in clean, paper-optimized format:

- Add "Print" button in reader mode and popup
- Print-specific CSS: optimized fonts, margins, no navigation/UI chrome
- Option to include/exclude images
- Trigger native `window.print()` dialog
