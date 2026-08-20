import { setAppVersion } from '@repo/domain/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary';
import { NotFound } from './components/NotFound';
import { routeTree } from './routeTree.gen';
import './assets/inter/inter.css';
import './styles/app.css';

setAppVersion(__APP_VERSION__);

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  defaultErrorComponent: DefaultCatchBoundary,
  defaultNotFoundComponent: () => <NotFound />,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function FatalError({ error }: { error: unknown }) {
  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: '42rem', margin: '0 auto' }}>
      <h1>Something went wrong loading OpenFeeds</h1>
      <p>Please refresh the page. If the problem persists, contact support.</p>
      <pre style={{ background: '#f5f5f5', padding: '1rem', overflow: 'auto', fontSize: '0.85em' }}>
        {error instanceof Error ? error.message : String(error)}
      </pre>
    </div>
  );
}

const rootElement = document.getElementById('root')!;

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary fallbackRender={({ error }) => <FatalError error={error} />}>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);
