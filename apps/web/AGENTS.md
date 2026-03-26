# Web Application - SolidJS + TanStack Start

Local-first SolidJS app. Data in client-side TanStack Solid DB, synced via Electric SQL, mutations via server functions.

## Commands

```bash
bun dev           # Development server (port 3000)
bun build         # Production build
bun start         # Start production server
bun check-types   # TypeScript checking
```

## Directory Structure

```
src/
  components/       # UI components (client-side only)
  entities/         # Local-first collections + server functions
    *.ts            # Client-side collection definitions
    *.functions.ts  # Server functions (createServerFn wrappers, safe to import from client)
  lib/              # Configured third-party clients
  providers/        # Context providers (theme, toast, session)
  server/           # Server-only code (auth, middleware)
    *.server.ts     # Enforced server-only by TanStack Start import-protection plugin
    middleware/      # Middleware (imported by *.functions.ts, uses dynamic imports for server deps)
  utils/            # Pure utility functions
  routes/           # File-based routing
    api/            # API routes for external consumers
    api/mcp/        # MCP server endpoint
    oauth/          # OAuth consent page
  env.ts            # Environment variables (t3-env)
```

**Import protection** (TanStack Start import-protection plugin):

Two systems work together:

1. **Start compiler** — rewrites `createServerFn`, `createMiddleware`, `createStart`, `createIsomorphicFn` calls. On client, strips `.server()` callback bodies, making server-only imports inside them unused.
2. **Import-protection plugin** — enforces file patterns (`**/*.server.*`) and specifier patterns (`@repo/db`, `@repo/domain`, `bun`) at build time. Uses deferral + tree-shaking: replaces violations with mocks, lets tree-shaking remove unused ones, only errors on violations that survive into the final bundle.

Key rules:
- `*.server.*` files are **blocked from client imports** at build time
- `*.functions.ts` files export `createServerFn` wrappers — safe to import from client (compiler rewrites to RPC stubs)
- `*.client.*` files are blocked from server imports
- The `src/server/` **directory name alone provides NO protection** — only the `*.server.*` file pattern is enforced

**Dynamic imports required** ([TanStack/router#2783](https://github.com/TanStack/router/issues/2783), [#5738](https://github.com/TanStack/router/issues/5738)):

Although the compiler strips `.server()` callback bodies, **top-level static imports of `*.server.*` files survive tree-shaking** and trigger the import-protection plugin. Files like middleware and guards that import from `*.server.*` or `@repo/domain` must use `await import()` inside `.server()` callbacks. Entity `*.functions.ts` files are the exception — their `createServerFn` handlers are compiled to RPC stubs, and the deferral + tree-shaking pipeline successfully eliminates their server imports.

**Server code locations**

- `src/server/*.server.ts` — auth config, well-known endpoints (server-only, enforced by `*.server.*` pattern)
- `src/server/middleware/auth.ts` — auth middleware (imported by `*.functions.ts`, uses dynamic imports internally)
- `src/start.ts` — global error boundary middleware (uses dynamic imports for `@repo/domain`)
- `src/lib/guards.ts` — route guards via `createIsomorphicFn` (uses dynamic imports in `.server()` branch)
- `src/entities/*.functions.ts` — entity server functions (safe for client import, static imports OK)
- `src/routes/api/` — API route handlers (use dynamic imports for server deps)

**Imports:** `~/` for cross-folder, `./` for same-folder. Never use `../`.

## Local-First Entity Pattern

Each entity in `src/entities/` is split into two files:

- **`entity.ts`** — Client-side collection (`createCollection` + `electricCollectionOptions`) with `useLiveQuery` hooks
- **`entity.functions.ts`** — Server functions using `createServerFn` with `authMiddleware` (safe to import from client)

Load the `new-entity` skill for the full end-to-end pattern (domain → collection → server functions → error handling).

**Import rule:**

- Client code → `@repo/domain/client` (schemas/types only)
- Server code → `@repo/domain` (full CRUD)

**API routes vs server functions:**

- Server functions → internal app use
- API routes (`src/routes/api/`) → external consumers (extension, webhooks)

## SolidJS

**Use SolidJS, NOT React.** The `solidjs` skill is auto-loaded with patterns, anti-patterns, and component conventions.

## OAuth Provider & MCP

See [docs/oauth-mcp.md](../../docs/oauth-mcp.md) for architecture. Key files:

- `src/server/auth.server.ts` — OAuth config
- `src/server/well-known.server.ts` — discovery endpoints
- `src/routes/api/mcp/$.ts` — MCP endpoint
- `src/routes/oauth/consent.tsx` — consent page

**Critical:** `src/server/auth.schema.server.ts` mirrors plugin setup for schema generation.
Keep in sync with `auth.server.ts` (but avoids importing `~/env`).

## Browser Debugging

Use the `playwright-cli` skill for browser interaction. Auth state saved at `.playwright-cli/auth.json` — load before navigating to authenticated pages.

## Notes

- Path mapping: `~/*` → `./src/*`
- TypeScript strict mode
- Devtools enabled in development
