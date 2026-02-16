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
    *.server.ts     # Server functions for entities
  lib/              # Configured third-party clients
  providers/        # Context providers (theme, toast, session)
  server/           # Server-only code (auth, middleware)
  utils/            # Pure utility functions
  routes/           # File-based routing
    api/            # API routes for external consumers
    api/mcp/        # MCP server endpoint
    oauth/          # OAuth consent page
  env.ts            # Environment variables (t3-env)
```

**Server code locations**

- `src/server/` — auth config, middleware
- `src/entities/*.server.ts` — entity server functions
- `src/routes/` — route loaders and API routes

**Imports:** `~/` for cross-folder, `./` for same-folder. Never use `../`.

## Local-First Entity Pattern

Each entity in `src/entities/` is split into two files:

- **`entity.ts`** — Client-side collection (`createCollection` + `electricCollectionOptions`) with `useLiveQuery` hooks
- **`entity.server.ts`** — Server functions using `createServerFn` with `authMiddleware`

**Import rule:**

- Client code → `@repo/domain/client` (schemas/types only)
- Server code → `@repo/domain` (full CRUD)

**Server function pattern:** `createServerFn({ method: 'POST' }).middleware([authMiddleware]).handler(...)` with `inputValidator` (Zod).

**API routes vs server functions:**

- Server functions → internal app use
- API routes (`src/routes/api/`) → external consumers (extension, webhooks)

## Error Handling

Domain errors in server functions are serialized by TanStack Start's `ShallowErrorPlugin` — only `message` survives.

- Client code uses `err.message` only
- No `instanceof`, no `code` property
- See [docs/error-handling.md](../../docs/error-handling.md)

## SolidJS Patterns

**Use SolidJS, NOT React:**

```tsx
// Conditional - use Show, not &&
<Show when={condition} fallback={<Fallback />}>
  <Content />
</Show>

// Lists - use For, not map
<For each={items}>{(item) => <Item item={item} />}</For>

// Multiple conditions - use Switch/Match
<Switch>
  <Match when={loading}>Loading...</Match>
  <Match when={error}>Error</Match>
  <Match when={data}>Success</Match>
</Switch>

// Reactive state
const [value, setValue] = createSignal(0);
```

## Styling

See [UI_DESIGN.md](./UI_DESIGN.md) for full design language.

- Mobile-first
- DaisyUI semantic colors (`base-100` background, `base-200` elevated, `base-300` borders)
- Content width: `max-w-2xl xl:max-w-3xl`

## Component Patterns

- **LazyModal** — wraps `<dialog>` with `<Show>`, destroys content on close. Use for all modals.
  - Controller pattern: `controller={(c) => { modalController = c; props.controller(c); }}`
- **Dropdown** — uses native Popover API (`popover="auto"`), renders in browser top-layer.
  - Immune to `overflow: hidden` and z-index issues.

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
