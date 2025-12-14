# Web Application - SolidJS Frontend Rules

## Commands

```bash
bun dev           # Development server
bun build         # Production build with TypeScript checking
bun start         # Start production server
bun check-types   # TypeScript checking only
```

## Tech Stack

- **Framework:** SolidJS with TanStack Router for routing
- **Styling:** Tailwind CSS v4 + DaisyUI components
- **Build:** Vite with SolidJS plugin
- **State:** SolidJS signals and TanStack Query for server state
- **API Client:** Eden Treaty (Elysia client) with type inference

## Directory Structure

- `src/routes/` - File-based routing with TanStack Router
- `src/components/` - Application-specific components
- `src/hooks/` - API hooks and utilities
- `src/lib/` - Utility functions and configurations

## API Integration

**Eden Treaty Pattern:**

```tsx
// hooks/api.ts - Single Eden instance with credentials
const api = useApi();

// Direct response destructuring
const { data, error } = await api.endpoint.get();
if (error) {
  throw new Error(error.value?.summary || error.value?.message || 'Request failed');
}
return data;

// Pass query params as objects (Eden handles conversion)
const { data, error } = await api.articles.get({
  query: { feedId: 1, limit: 20 },
  fetch: { signal },
});
```

**TanStack Query Integration:**

```tsx
// hooks/queries.ts - Wrap Eden calls in TanStack Query
export function useFeeds() {
  const api = useApi();
  return useQuery(() => ({
    queryKey: ['feeds'],
    queryFn: async ({ signal }) => {
      const { data, error } = await api.feeds.get({ fetch: { signal } });
      if (error) throw new Error(error.value?.summary || error.value?.message || 'Request failed');
      return data;
    },
  }));
}
```

**Key Points:**

- No helper abstractions - unwrap responses directly
- Eden auto-includes cookies via `credentials: 'include'`
- Query params passed as objects, not strings
- Error handling: check `error.value?.summary` or `error.value?.message`

## SolidJS Patterns

**Reactive State:**

```tsx
// Use createSignal for local reactive state
const [count, setCount] = createSignal(0);

// Use createContext with TypeScript for shared state
const UserContext = createContext<{ user: User | null }>();
```

**JSX Patterns (NOT React):**

```tsx
// Conditional - use Show, not &&
<Show when={user.isLoggedIn} fallback={<LoginButton />}>
  <WelcomeMessage user={user} />
</Show>

// Lists - use For, not map
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

## Styling

**DaisyUI Semantic Colors:**

- `base-100` - Background of content areas
- `base-200` - Background for global backdrop, tooltips, dropdowns
- `base-300` - Border colors

**Tailwind Best Practices:**

- Use utility-first approach
- Use `@apply` directive in CSS files for reusable component styles
- Implement responsive design with Tailwind's responsive classes
- Use Tailwind v4 features (CSS-first configuration)
- `.tsx` extension for JSX components

## Component Patterns

**Modal Pattern - LazyModal:**

All modals use `LazyModal` for proper cleanup:

```tsx
// Modal wrapper component
export function MyModal(props: MyModalProps) {
  let modalController!: ModalController;

  return (
    <LazyModal
      controller={(controller) => {
        modalController = controller;
        props.controller(controller);
      }}
      title="Modal Title"
    >
      <MyModalForm onClose={() => modalController.close()} />
    </LazyModal>
  );
}

// Separate form component for content
function MyModalForm(props: { onClose: () => void }) {
  // Fresh component created on each modal open
  // All state/queries initialized fresh
  // Automatically destroyed when modal closes
  return <form>...</form>;
}
```

**Why LazyModal?**

- Uses `<Show when={isOpen()}>` to destroy content when closed
- Prevents stale state/queries from persisting
- Fresh component instance on each open
- Memory efficient

## Key Components

- `YouTubeVideoEmbed.tsx` - Regular YouTube videos
- `YouTubeShortsEmbed.tsx` - YouTube Shorts detection and display
- `ReadStatusToggle.tsx` - Mark articles as read/unread

## Development Notes

- TypeScript strict mode enabled
- Path mapping: `~/*` maps to `./src/*`
- TanStack Router devtools enabled in development
- Use `createSignal()` instead of `useState()`
- Prefer SolidJS patterns over React equivalents
