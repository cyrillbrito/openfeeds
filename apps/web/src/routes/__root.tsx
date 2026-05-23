import { TanStackDevtools } from '@tanstack/solid-devtools';
import { createRootRoute, Outlet } from '@tanstack/solid-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/solid-router-devtools';
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
    if (posthogKey) {
      void import('../utils/posthog').then(({ initPosthog }) => {
        initPosthog(posthogKey);
      });
    }
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
