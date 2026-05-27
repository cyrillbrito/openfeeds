import { createRootRoute, Outlet } from '@tanstack/solid-router';
import { posthog } from 'posthog-js';
import { onMount, Suspense } from 'solid-js';
import { api, unwrap } from '~/lib/api-client';
import { SessionReadProvider } from '~/providers/session-read';
import { ThemeProvider } from '~/providers/theme';
import { ToastProvider } from '~/providers/toast';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  onMount(async () => {
    const config = await unwrap(api.api['public-config'].config.$get({}));
    if (!config.posthogKey) return;
    posthog.init(config.posthogKey, {
      api_host: 'https://ph.openfeeds.app',
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      capture_exceptions: true,
      defaults: '2025-05-24',
    });
    posthog.register({ app: 'web', app_version: __APP_VERSION__ });
  });

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
