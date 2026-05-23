import { TanStackDevtools } from '@tanstack/solid-devtools';
import { createRootRoute, Outlet } from '@tanstack/solid-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/solid-router-devtools';
import { posthog } from 'posthog-js';
import { onMount, Suspense } from 'solid-js';
import { SessionReadProvider } from '~/providers/session-read';
import { ThemeProvider } from '~/providers/theme';
import { ToastProvider } from '~/providers/toast';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  onMount(() => {
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
    if (!posthogKey) return;
    posthog.init(posthogKey, {
      api_host: 'https://ph.openfeeds.app',
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      capture_exceptions: true,
    });
    posthog.register({ app: 'web', app_version: __APP_VERSION__ });
  });

  return (
    <Suspense>
      <ThemeProvider>
        <SessionReadProvider>
          <ToastProvider>
            <Outlet />
            <TanStackDevtools
              config={{ hideUntilHover: true }}
              plugins={[
                {
                  name: 'TanStack Router',
                  render: () => <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </ToastProvider>
        </SessionReadProvider>
      </ThemeProvider>
    </Suspense>
  );
}
