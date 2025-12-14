/// <reference types="vite/client" />
import { TanStackDevtools } from '@tanstack/solid-devtools';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { SolidQueryDevtoolsPanel } from '@tanstack/solid-query-devtools';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/solid-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/solid-router-devtools';
import { DefaultCatchBoundary } from '../components/DefaultCatchBoundary';
import { NotFound } from '../components/NotFound';
import { ThemeProvider } from '../hooks/theme';
import { ToastProvider } from '../hooks/toast';
import interCss from '../inter/inter.css?url';
import appCss from '../styles/app.css?url';
import { seo } from '../utils/seo';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charset: 'utf-8',
      },

      ...seo({
        title: 'OpenFeeds',
        description:
          'A centralized RSS feed reader where you control what you see. No algorithms, no distractions.',
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: interCss },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: () => <NotFound />,
  shellComponent: RootDocument,
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      throwOnError: true,
      retry: 1,
      networkMode: 'online',
    },
    mutations: {
      retry: 1,
      networkMode: 'online',
    },
  },
});

function RootDocument() {
  return (
    <>
      <HeadContent />

      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <Outlet />
            <TanStackDevtools
              config={{
                hideUntilHover: true,
              }}
              plugins={[
                {
                  name: 'Router',
                  render: () => <TanStackRouterDevtoolsPanel />,
                },
                {
                  name: 'Query',
                  render: () => <SolidQueryDevtoolsPanel />,
                },
              ]}
            />
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>

      <Scripts />
    </>
  );
}
