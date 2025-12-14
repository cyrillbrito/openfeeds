# OpenFeeds Development Rules

## Commands

**Use bun only (not npm/pnpm/yarn):**

```bash
bun dev          # Start dev servers
bun build        # Build all apps
bun check-types  # TypeScript checking
bun lint         # oxlint type-aware linting
bun checks       # Type check + lint
```

When DB migrations are needed, ask the user to run them for security reasons.

## Architecture Overview

**Monorepo Structure:**

- `apps/web/` - SolidJS frontend with TanStack Router
- `apps/server/` - Elysia API server with Bun runtime
- `apps/e2e/` - Playwright tests with visual regression
- `packages/db/` - Drizzle ORM + SQLite3
- `packages/discovery/` - RSS feed discovery
- `packages/shared/` - Shared utilities

**Tech Stack:**

- **Frontend:** SolidJS, TanStack Router, Tailwind v4, DaisyUI, Eden Treaty
- **Backend:** Elysia, Bun, Better Auth, Zod, BullMQ
- **Database:** SQLite3, Drizzle ORM
- **Build:** Turborepo, Vite (web), Bun (API)
- **Testing:** Playwright with screenshots
- **Queue:** BullMQ + Redis

**Database:**

- User DB: feeds, articles, tags, read status
- Auth DB: Better Auth schema
- Separate Drizzle configs for user/auth
- Migrations in packages/db

## SolidJS Guidelines

**Reactive Patterns:**

- Use `createSignal()` for local reactive state
- Use `createContext()` with TypeScript for shared state
- Prefer SolidJS patterns over React patterns

**JSX Rendering (NOT React patterns):**

```tsx
// Conditional rendering - use Show, not &&
<Show when={user.isLoggedIn} fallback={<LoginButton />}>
  <WelcomeMessage user={user} />
</Show>

// List rendering - use For, not map
<For each={items} fallback={<div>No items found</div>}>
  {(item, index) => <ItemCard item={item} index={index()} />}
</For>

// Multiple conditions - use Switch
<Switch>
  <Match when={status === 'loading'}>Loading...</Match>
  <Match when={status === 'error'}>Error occurred</Match>
  <Match when={status === 'success'}>Success!</Match>
</Switch>
```

## Styling Guidelines

- Use Tailwind CSS v4 with utility-first approach
- DaisyUI semantic colors: `base-100` (content bg), `base-200` (backdrop), `base-300` (borders)
- Use `@apply` directive in CSS files for reusable styles
- `.tsx` extension for JSX components

## Backend Patterns

**Elysia API:**

- OpenAPI + Zod validation
- Better Auth middleware
- Eden Treaty for type-safe client
- `src/environment.ts` - env config
- `src/db-utils.ts` - DB utilities

**BullMQ Jobs:**

- `apps/server/src/queue/` - config, workers, scheduler
- Feed Sync Orchestrator - Cron (every min), enqueues feed jobs
- Single Feed Sync - Worker processes individual feeds
- Auto Archive - Daily old article cleanup
- Bull Board at `/admin/queues`

## Packages

- **shared:** Cross-app utilities, no internal API/DB details
- **discovery:** RSS feed discovery and analysis
- **db:** Drizzle schemas and migrations
- **scripts:** Build scripts

## Code Quality

- Never modify tsconfig or use `// @ts-ignore`
- Run `bun check-types` after changes
- Generate migrations after schema changes
- TypeScript strict mode enabled
- Lint with oxlint (type-aware)

## Testing

- E2E tests in `apps/e2e/`
- Zero-trace - tests clean up all data
- Visual regression + functional tests
- Dynamic test data (timestamp emails)
- Page Object Model pattern
- Mock server for RSS feeds

## Linear Integration

When projects/issues are mentioned, use Linear MCP server.

**IDs (avoid refetching):**

- Team: `c41677a4-bded-49d7-b20d-b6bf1d8f1d4a` (Alpha)
- Feed Discovery: `1bd4998c-428f-4023-a7d5-87c22cf2e5d1`
- User: `5a1113d3-a2e4-4d14-ba44-bf8ae0ac9fc1` (Cyrill)
