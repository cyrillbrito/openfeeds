import { TanStackDevtools } from '@tanstack/solid-devtools';
import { ClientOnly, createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/solid-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/solid-router-devtools';
import { onMount, Suspense } from 'solid-js';
import { HydrationScript } from 'solid-js/web';
import { CenterLoader } from '~/components/Loader';
import { SessionReadProvider } from '~/hooks/session-read';
import { ThemeProvider } from '~/hooks/theme';
import { ToastProvider } from '../hooks/toast';
import interCss from '../inter/inter.css?url';
import appCss from '../styles/app.css?url';

export const Route = createRootRoute({
  ssr: false,
  head: () => ({
    meta: [
      { charset: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no',
      },
      { name: 'theme-color', content: '#000000' },
      {
        name: 'description',
        content:
          'A centralized RSS feed reader where you control what you see. No algorithms, no distractions.',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'stylesheet', href: interCss },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    ],
    title: 'OpenFeeds',
  }),
  shellComponent: RootComponent,
});

function RootComponent() {
  onMount(() => {
    import('../utils/posthog');
  });

  return (
    <html>
      <head>
        <HeadContent />
        <HydrationScript />
      </head>
      <body>
        <Suspense>
          <ClientOnly fallback={<CenterLoader />}>
            <ThemeProvider>
              <SessionReadProvider>
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
                    ]}
                  />
                </ToastProvider>
              </SessionReadProvider>
            </ThemeProvider>
          </ClientOnly>
        </Suspense>

        <Scripts />
      </body>
    </html>
  );
}
