import { TanStackDevtools } from '@tanstack/solid-devtools';
import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/solid-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/solid-router-devtools';
import { onMount, Suspense } from 'solid-js';
import { HydrationScript } from 'solid-js/web';
import interCss from '~/assets/inter/inter.css?url';
import { ThemeScript } from '~/components/ThemeScript';
import { SessionReadProvider } from '~/providers/session-read';
import { ThemeProvider } from '~/providers/theme';
import { ToastProvider } from '~/providers/toast';
import { $$getPublicConfig } from '~/server/public-config.functions';
import appCss from '~/styles/app.css?url';

let publicConfigCache: Awaited<ReturnType<typeof $$getPublicConfig>> | undefined;

export const Route = createRootRoute({
  beforeLoad: async () => {
    publicConfigCache ??= await $$getPublicConfig();
    return { publicConfig: publicConfigCache };
  },
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
  const context = Route.useRouteContext();

  onMount(() => {
    const posthogKey = context()?.publicConfig?.posthogKey;
    if (posthogKey) {
      import('../utils/posthog').then(({ initPosthog }) => {
        initPosthog(posthogKey);
      });
    }
  });

  return (
    <html>
      <head>
        <ThemeScript />
        <HeadContent />
        <HydrationScript />
      </head>
      <body>
        <Suspense>
          <ThemeProvider>
            <SessionReadProvider>
              <ToastProvider>
                <Outlet />
                <TanStackDevtools
                  config={{ hideUntilHover: true }}
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
        </Suspense>

        <Scripts />
      </body>
    </html>
  );
}
