import { createRootRoute, Outlet } from '@tanstack/react-router';
import { posthog } from 'posthog-js';
import { Suspense, useEffect } from 'react';
import { SessionReadProvider } from '~/providers/session-read';
import { ThemeProvider } from '~/providers/theme';
import { ToastProvider } from '~/providers/toast';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  useEffect(() => {
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
    if (!posthogKey) return;
    posthog.init(posthogKey, {
      api_host: 'https://ph.openfeeds.app',
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      capture_exceptions: true,
    });
    posthog.register({ app: 'web', app_version: __APP_VERSION__ });
  }, []);

  return (
    <Suspense>
      <ThemeProvider>
        <SessionReadProvider>
          <ToastProvider>
            <Outlet />
          </ToastProvider>
        </SessionReadProvider>
      </ThemeProvider>
    </Suspense>
  );
}
