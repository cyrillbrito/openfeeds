import { createRouter } from '@tanstack/solid-router';
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary';
import { NotFound } from './components/NotFound';
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
    getScrollRestorationKey: (location) => {
      const pathname = location.pathname;
      const isListRoute =
        pathname === '/inbox' || pathname.startsWith('/feeds') || pathname.startsWith('/tags');

      if (!isListRoute) {
        return location.state.__TSR_key!;
      }

      const searchKey = Object.entries(location.search ?? {})
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}:${String(value)}`)
        .join('&');

      return `${pathname}?${searchKey}`;
    },
  });

  return router;
};
