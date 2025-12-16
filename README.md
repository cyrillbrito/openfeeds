# OpenFeeds

**Your feed, your rules.** A modern, privacy-focused RSS reader built for the way you consume content.

<img src="docs/logo-alt.svg" alt="OpenFeeds Logo" width="200">

---

## Why OpenFeeds?

Tired of algorithmic feeds deciding what you should see? OpenFeeds puts you back in control. Subscribe to blogs, news sites, YouTube channels, and podcasts - all in one clean interface without tracking, ads, or manipulation.

### Key Features

- **Universal Feed Support** - RSS, Atom, YouTube channels, and more
- **Smart Discovery** - Paste any URL and let OpenFeeds find the feed
- **Readability Mode** - Clean article extraction for distraction-free reading
- **OPML Import/Export** - Migrate from any other reader seamlessly
- **Background Sync** - Your feeds update automatically
- **Self-Hosted** - Your data stays on your server

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/feeds-overview.png" alt="Feeds Overview" width="24%">
  <img src="docs/screenshots/feed-list-view.png" alt="Feed List" width="24%">
  <img src="docs/screenshots/article-reader-view.png" alt="Article Reader" width="24%">
  <img src="docs/screenshots/tags-management.png" alt="Tags Management" width="24%">
</p>

---

## Tech Stack

| Layer        | Technology                                         |
| ------------ | -------------------------------------------------- |
| **Frontend** | SolidJS, TanStack Router, Tailwind CSS v4, DaisyUI |
| **Backend**  | Elysia, Bun Runtime, Eden Treaty (E2E type-safe)   |
| **Database** | SQLite3, Drizzle ORM                               |
| **Auth**     | Better Auth                                        |
| **Jobs**     | BullMQ, Redis                                      |
| **Testing**  | Playwright (E2E + Visual Regression)               |
| **Build**    | Turborepo, Vite                                    |

### Architecture Highlights

- **Monorepo** - Clean separation between web, server, and shared packages
- **Type-Safe End-to-End** - From database to UI, everything is typed
- **Zero-Trace Testing** - E2E tests that clean up after themselves

---

## Quick Start

```bash
bun install
bun dev
```

- **Web:** http://localhost:3001
- **API:** http://localhost:3000

---

## Self-Hosting

<!-- TODO: Add deployment instructions -->

Coming soon.

---

## Project Structure

```
openfeeds/
├── apps/
│   ├── web/          # SolidJS frontend
│   ├── server/       # Elysia API server
│   ├── worker/       # Background job processor
│   └── e2e/          # Playwright test suite
└── packages/
    ├── db/           # Drizzle ORM schemas & migrations
    ├── discovery/    # RSS/Atom feed discovery engine
    ├── domain/       # Shared business logic
    └── shared/       # Cross-app utilities
```
