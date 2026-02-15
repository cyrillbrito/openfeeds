# Web Application - SolidJS + TanStack Start

## Overview

Local-first SolidJS app with TanStack Start. Data stored in client-side TanStack Solid DB with server sync via server functions.

## Commands

```bash
bun dev           # Development server (port 3000)
bun build         # Production build
bun start         # Start production server
bun check-types   # TypeScript checking
```

## Tech Stack

- **Framework:** SolidJS + TanStack Start (SSR/server functions)
- **Local-First:** TanStack Solid DB + Query DB Collection
- **Routing:** TanStack Solid Router (file-based)
- **Styling:** Tailwind CSS v4 + DaisyUI
- **Build:** Vite + Nitro

## Directory Structure

```
src/
  assets/           # Static assets (fonts, images)
    inter/          # Inter font files
  components/       # UI components (client-side only)
  entities/         # Local-first collections + server functions
    *.ts            # Client-side collection definitions
    *.server.ts     # Server functions for entities
  lib/              # Configured third-party clients
    auth-client.ts  # Better Auth client (client-side)
    electric-*.ts   # Electric SQL clients
  providers/        # Context providers (JSX)
    theme.tsx       # Theme context (light/dark/system)
    toast.tsx       # Toast notifications
    session-read.tsx
  server/           # Server-only code
    auth.ts         # Better Auth server config (OAuth provider)
    auth.schema.ts  # Schema-generation copy of auth config
    well-known.ts   # .well-known endpoint handlers
    dev-cors.ts     # Dev-only CORS for MCP Inspector
    middleware/     # Request middleware
  utils/            # Pure utility functions
    html.ts         # HTML sanitization
    youtube.ts      # YouTube URL helpers
    routing.ts      # Route search validation
    tagColors.ts    # Tag color helpers
  routes/           # File-based routing
    api/            # API routes for external consumers
    api/mcp/        # MCP server endpoint
    oauth/          # OAuth consent page
  styles/           # Global CSS
  env.ts            # Environment variables (t3-env)
```

### Server Code Rule

Server code should ONLY live in:

- `src/server/` - Auth config, middleware
- `src/entities/*.server.ts` - Entity server functions
- `src/routes/` - Route loaders and API routes

All other folders (`components/`, `lib/`, `providers/`, `utils/`) must be client-safe.

### Import Convention

Use `~/` for cross-folder imports, `./` for same-folder imports:

```tsx
// Same folder - use relative imports

// Cross-folder - use ~/ alias
import { Header } from '~/components/Header';
import { authClient } from '~/lib/auth-client';
import { useTheme } from '~/providers/theme';
// Avoid going up directories
import { Header } from '../components/Header'; // Don't do this
import { ColorIndicator } from './ColorIndicator';
import { LazyModal } from './LazyModal';
```

## Local-First Pattern

**Entity Collections:**

Each entity in `src/entities/` is split into two files:

- **`entity.ts`** - Collection definition + hooks (client-side)
- **`entity.server.ts`** - Server functions (server-side)

```tsx
// entities/feeds.ts (client-side collection)
import { FeedSchema } from '@repo/domain/client';  // Client-safe import
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { $$createFeeds, $$deleteFeeds } from './feeds.server';

export const feedsCollection = createCollection(
  electricCollectionOptions({
    id: 'feeds',
    schema: FeedSchema,
    getKey: (item) => item.id,
    shapeOptions: { url: getShapeUrl('feeds') },
    onInsert: async ({ transaction }) => {
      await $$createFeeds({ data: [...] });
    },
    // ...
  }),
);

export function useFeeds() {
  return useLiveQuery((q) => q.from({ feed: feedsCollection }));
}
```

```tsx
// entities/feeds.server.ts (server functions)
import * as feedsDomain from '@repo/domain'; // Server import
import { createServerFn } from '@tanstack/solid-start';
import { authMiddleware } from '~/server/middleware/auth';

export const $$createFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    return feedsDomain.createFeeds(context.user.id, data);
  });
```

**Import pattern for `@repo/domain`:**

```typescript
// Client code (components, routes, entity.ts files)

// Server code (entity.server.ts, server/, api routes)
import { createFeed } from '@repo/domain';
import { FeedSchema, type Feed } from '@repo/domain/client';
```

**Key Points:**

- Client files import schemas/types from `@repo/domain/client`
- Server files import functions from `@repo/domain`
- `createCollection` creates client-side collection with Electric SQL sync
- `useLiveQuery` provides reactive data access
- Auth via `authMiddleware` in `src/server/middleware/auth.ts`

## Error Handling

Domain errors thrown in server functions are serialized by TanStack Start's `ShallowErrorPlugin` — only `message` survives. The client receives a plain `Error` with the domain error's message. `instanceof`, `code`, and all custom properties are stripped. Client code only needs `err.message`. See [docs/error-handling.md](../../docs/error-handling.md) for full architecture.

## Server Functions

Server functions replace direct API calls. They run on the server with full access to domain logic.

```tsx
// Define server function
export const $$doSomething = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ context, data }) => {
    return domain.doSomething(data.id, context.user.id);
  });

// Use in component
const result = await $$doSomething({ data: { id: '123' } });
```

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

See [UI_DESIGN.md](./UI_DESIGN.md) for full design language documentation.

**Quick Reference:**

- **Mobile-first** - Design for small screens, enhance for larger
- `base-100` - Default app background (global)
- `base-200` - Elevated surfaces (dropdowns, tooltips, hover states)
- `base-300` - Borders
- Content width constrained to `max-w-2xl xl:max-w-3xl` (widens from 672px to 768px on xl screens)

**Tailwind v4:**

- Utility-first approach
- Use `@apply` in CSS for reusable styles
- CSS-first configuration

## Component Patterns

**LazyModal:**

```tsx
export function MyModal(props: MyModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(c) => {
        modalController = c;
        props.controller(c);
      }}
      title="Title"
    >
      <MyModalForm onClose={() => modalController.close()} />
    </LazyModal>
  );
}
```

Uses `<Show>` internally - destroys content when closed, fresh state on reopen.

**Dropdown (Popover-based):**

```tsx
<Dropdown end btnClasses="btn-sm" btnContent={<EllipsisVertical size={20} />}>
  <li>
    <button onClick={handleEdit}>Edit</button>
  </li>
  <li>
    <button onClick={handleDelete}>Delete</button>
  </li>
</Dropdown>
```

Uses native Popover API (`popover="auto"`) — renders in browser top-layer, immune to `overflow: hidden` and z-index issues. See `UI_DESIGN.md` "Overlays & Layering" for full rules.

## OAuth Provider & MCP

OpenFeeds acts as an OAuth 2.1 Authorization Server for MCP (Model Context Protocol) clients. See [docs/oauth-mcp.md](../../docs/oauth-mcp.md) for the full architecture doc.

**Key files:**

- `src/server/auth.ts` — `oauthProvider()` + `jwt()` plugins configure the OAuth server
- `src/server/well-known.ts` — `.well-known` discovery endpoints (intercepted in `src/server.ts` because file-based routing can't handle dotfile paths)
- `src/server/dev-cors.ts` — Dev-only CORS middleware for MCP Inspector (no-op in production, tree-shaken)
- `src/routes/oauth/consent.tsx` — Consent page where users approve/deny MCP client access
- `src/routes/api/mcp/$.ts` — MCP server endpoint (stateless, JWT-verified via `mcpHandler`)
- `src/lib/auth-client.ts` — Includes `oauthProviderClient()` plugin for client-side OAuth methods

**Scopes:** `openid`, `profile`, `email`, `offline_access`, `mcp:tools`

**Database:** 5 new tables (`jwks`, `oauth_client`, `oauth_access_token`, `oauth_refresh_token`, `oauth_consent`) — managed by Better Auth, migration in `packages/db/drizzle/0002_add-oauth.sql`.

**When modifying the auth config:** `src/server/auth.schema.ts` mirrors the plugin setup for schema generation. Keep it in sync with `auth.ts` (but it intentionally avoids importing `~/env`).

## API Routes

TanStack Start can expose traditional API routes in `src/routes/api/`. Use for external integrations (e.g., browser extension, MCP clients).

```tsx
// src/routes/api/feeds.ts
import { createAPIFileRoute } from '@tanstack/solid-start/api';

export const Route = createAPIFileRoute('/api/feeds')({
  POST: async ({ request }) => {
    // Handle POST /api/feeds
    const body = await request.json();
    // ... call domain logic
    return Response.json({ success: true });
  },
});
```

**When to use API routes vs server functions:**

- **Server functions**: Internal app use, called from components
- **API routes**: External consumers (extension, webhooks, third-party)

## Browser Debugging with Playwright CLI

When the user asks to check something in the browser, or when visual verification is needed, use the `playwright-cli` skill to interact with the running dev server.

**Load the skill first:** The `playwright-cli` skill must be loaded before use. It provides the full command reference.

**Authentication:** Auth state is saved at `.playwright-cli/auth.json`. Load it before navigating to authenticated pages:

```bash
playwright-cli open http://localhost:3000    # Start session (lands on /signin)
playwright-cli state-load .playwright-cli/auth.json  # Restore auth cookies
playwright-cli open http://localhost:3000    # Navigate again, now authenticated
```

If the saved state has expired (redirects to `/signin` after loading), log in again and re-save:

```bash
playwright-cli open http://localhost:3000/signin
playwright-cli snapshot                      # Get element refs
playwright-cli fill <email-ref> "asd@asd.pt"
playwright-cli fill <password-ref> "asd123"
playwright-cli click <signin-button-ref>
playwright-cli state-save .playwright-cli/auth.json  # Save for next time
```

**Common tasks:**

```bash
playwright-cli snapshot                      # Get page structure + element refs
playwright-cli screenshot                    # Take screenshot of current page
playwright-cli screenshot <ref>              # Screenshot specific element
playwright-cli console                       # Check console logs/errors
playwright-cli network                       # Check network requests
playwright-cli eval "document.title"         # Evaluate JS in page
```

**Session lifecycle:**

```bash
playwright-cli session-stop                  # Stop session (preserves profile)
playwright-cli session-delete                # Delete profile data (will need to re-auth)
```

Always stop sessions when done. Never use `session-delete` unless you want to clear auth state.

## Notes

- Path mapping: `~/*` → `./src/*`
- TypeScript strict mode
- Devtools enabled in development
