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
  server/           # Server-only code (auth, middleware) — blocked from client imports
  utils/            # Pure utility functions
  routes/           # File-based routing
    api/            # API routes for external consumers
    api/mcp/        # MCP server endpoint
    oauth/          # OAuth consent page
  env.ts            # Environment variables (t3-env)
```

**Import protection** (TanStack Start plugin, enabled in `vite.config.ts`):

- `*.server.*` files and `src/server/` directory are **blocked from client imports**
- `*.functions.ts` files export `createServerFn` wrappers — safe to import from client (compiler rewrites to RPC stubs)
- `*.client.*` files are blocked from server imports

**Server code locations**

- `src/server/` — auth config, middleware (server-only, cannot be imported from client code)
- `src/entities/*.functions.ts` — entity server functions (safe for client import)
- `src/routes/` — route loaders and API routes

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

- `src/server/auth.ts` — OAuth config
- `src/server/well-known.ts` — discovery endpoints
- `src/routes/api/mcp/$.ts` — MCP endpoint
- `src/routes/oauth/consent.tsx` — consent page

**Critical:** `src/server/auth.schema.ts` mirrors plugin setup for schema generation.
Keep in sync with `auth.ts` (but avoids importing `~/env`).

## Browser Debugging

Use the `playwright-cli` skill for browser interaction. Auth state saved at `.playwright-cli/auth.json` — load before navigating to authenticated pages.

## Notes

- Path mapping: `~/*` → `./src/*`
- TypeScript strict mode
- Devtools enabled in development
