/**
 * Storybook decorator that wraps stories in a minimal TanStack Router context.
 *
 * Components that use `<Link>` need a router context. This provides one
 * using an in-memory history so stories don't need a real browser URL.
 *
 * We call `router.load()` eagerly so that internal router state (location,
 * matches, etc.) is populated before any `<Link>` component tries to read it.
 */
import type { AnyRouter } from '@tanstack/solid-router';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterContextProvider,
} from '@tanstack/solid-router';
import { type JSXElement, Suspense } from 'solid-js';

const rootRoute = createRootRoute();

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => null,
});

// Catch-all so `<Link to="/articles/$articleId">` etc. don't warn about missing routes
const catchAllRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$',
  component: () => null,
});

const routeTree = rootRoute.addChildren([indexRoute, catchAllRoute]);

function createStoryRouter() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  // Eagerly load so router.state is populated before first render
  void router.load();

  return router;
}

/**
 * Storybook decorator — wraps the story in a TanStack Router context.
 *
 * Usage:
 *   decorators: [withRouter]
 */
export function withRouter(Story: () => JSXElement) {
  const router = createStoryRouter();
  return (
    <RouterContextProvider router={router as unknown as AnyRouter}>
      {() => (
        <Suspense>
          <Story />
        </Suspense>
      )}
    </RouterContextProvider>
  );
}
