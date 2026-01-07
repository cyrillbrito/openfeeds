import { createRouter } from '@tanstack/solid-router';
import { setupRouterSsrQueryIntegration } from '@tanstack/solid-router-ssr-query';
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary';
import { NotFound } from './components/NotFound';
import { queryClient } from './query-client';
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
  });

  setupRouterSsrQueryIntegration({ router, queryClient: queryClient, wrapQueryClient: true });

  return router;
};
