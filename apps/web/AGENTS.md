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

- `src/routes/` - File-based routing
- `src/entities/` - Local-first collections + server functions
- `src/components/` - UI components
- `src/server/` - Server-only code (auth middleware)
- `src/hooks/` - Custom hooks
- `src/lib/` - Utilities

## Local-First Pattern

**Entity Collections:**

Each entity in `src/entities/` follows this pattern:

```tsx
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { createServerFn } from '@tanstack/solid-start';

// Server functions (run on server)
const $$getAll = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = getUserDb(context.user.id);
    return domain.getAll(db);
  });

const $$create = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(CreateSchema)
  .handler(({ context, data }) => {
    const db = getUserDb(context.user.id);
    return domain.create(data, db);
  });

// Collection (client-side with sync)
export const itemsCollection = createCollection(
  queryCollectionOptions({
    id: 'items',
    queryKey: ['items'],
    queryClient,
    getKey: (item) => item.id,
    schema: ItemSchema,
    queryFn: () => $$getAll(),
    onInsert: async ({ transaction }) => {
      /* sync to server */
    },
    onUpdate: async ({ transaction }) => {
      /* sync to server */
    },
    onDelete: async ({ transaction }) => {
      /* sync to server */
    },
  }),
);

// Hook for components
export function useItems() {
  return useLiveQuery((q) => q.from({ item: itemsCollection }));
}
```

**Key Points:**

- `createServerFn` defines server functions (RPC-style)
- `createCollection` creates client-side collection with sync callbacks
- `useLiveQuery` provides reactive data access
- Auth via `authMiddleware` in `src/server/middleware/auth.ts`

## Server Functions

Server functions replace direct API calls. They run on the server with full access to domain logic.

```tsx
// Define server function
export const $$doSomething = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ context, data }) => {
    const db = getUserDb(context.user.id);
    return domain.doSomething(data.id, db);
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
- Content width constrained to `max-w-2xl` on desktop

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

## API Routes

TanStack Start can expose traditional API routes in `src/routes/api/`. Use for external integrations (e.g., browser extension).

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

## Notes

- Path mapping: `~/*` → `./src/*`
- TypeScript strict mode
- Devtools enabled in development
