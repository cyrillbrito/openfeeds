/* @refresh reload */
import { setAppVersion } from '@repo/domain/client';
import { RouterProvider } from '@tanstack/solid-router';
import { ErrorBoundary } from 'solid-js';
import { render } from 'solid-js/web';
import { getRouter } from './router';
import './assets/inter/inter.css';
import './styles/app.css';

setAppVersion(__APP_VERSION__);

const router = getRouter();

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}

/**
 * Last-resort error boundary. Catches anything thrown synchronously during
 * the initial render (router init, plugin loading, top-level providers).
 * Per-route errors are handled by the router's own boundary; this only
 * fires on cold-load catastrophes.
 */
function FatalError(props: { error: unknown }) {
  return (
    <div style="font-family:system-ui;padding:2rem;max-width:42rem;margin:0 auto;">
      <h1>Something went wrong loading OpenFeeds</h1>
      <p>Please refresh the page. If the problem persists, contact support.</p>
      <pre style="background:#f5f5f5;padding:1rem;overflow:auto;font-size:0.85em;">
        {props.error instanceof Error ? props.error.message : String(props.error)}
      </pre>
    </div>
  );
}

const rootElement = document.getElementById('root')!;

render(
  () => (
    <ErrorBoundary fallback={(error) => <FatalError error={error} />}>
      <RouterProvider router={router} />
    </ErrorBoundary>
  ),
  rootElement,
);
