# openfeeds

OpenFeeds - Your feed, your rules. A centralized RSS feed reader where you control what you see.

## Tech Stack

- **SolidJS** + TanStack Router - Reactive frontend
- **Tailwind CSS v4** + DaisyUI - Styling
- **Elysia** + Eden Treaty - Type-safe API
- **Bun** - Runtime
- **Drizzle ORM** + SQLite3 - Database
- **Better Auth** - Authentication
- **BullMQ** + Redis - Background jobs
- **Playwright** - E2E testing

## Quick Start

```bash
bun install
bun dev
```

- Web: http://localhost:3001
- API: http://localhost:3000

## Project Structure

```
openfeeds/
├── apps/
│   ├── web/         # SolidJS frontend
│   ├── api/         # Elysia backend
│   └── e2e/         # Playwright tests
└── packages/
    ├── db/          # Drizzle ORM schemas
    ├── discovery/   # RSS feed discovery
    ├── shared/      # Shared utilities
    └── scripts/     # Build scripts
```

## Commands

- `bun dev` - Start dev servers
- `bun build` - Build all apps
- `bun check-types` - TypeScript checking
- `bun lint` - Run oxlint
- `bun checks` - Type check + lint

## Features

- RSS/Atom feed parsing and discovery
- Article readability extraction
- OPML import/export
- YouTube video/shorts detection
- Background feed sync with BullMQ
- Read status tracking
- Zero-trace E2E testing
