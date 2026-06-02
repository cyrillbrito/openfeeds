import { createRootRoute, Outlet, useRouter } from '@tanstack/solid-router';
import { posthog } from 'posthog-js';
import { onMount, Suspense } from 'solid-js';
import { SessionReadProvider } from '~/providers/session-read';
import { ThemeProvider } from '~/providers/theme';
import { ToastProvider } from '~/providers/toast';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const router = useRouter();

  onMount(() => {
    const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
    if (!posthogKey) return;
    posthog.init(posthogKey, {
      api_host: 'https://ph.openfeeds.app',
      ui_host: 'https://eu.posthog.com',
      defaults: '2025-05-24',
      person_profiles: 'identified_only',
      capture_exceptions: true,
      capture_pageview: false,
    });
    posthog.register({ app: 'web', app_version: __APP_VERSION__ });

    // Capture pageview on every SPA navigation (initial + route changes).
    router.subscribe('onResolved', ({ toLocation }) => {
      posthog.capture('$pageview', { $current_url: window.location.href, path: toLocation.pathname });
    });
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
