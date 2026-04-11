import { createMiddleware, createStart } from '@tanstack/solid-start';

/**
 * Global error boundary for all server functions (createServerFn).
 *
 * Catches errors after all per-function middleware (auth, validation) and the handler
 * have executed. Infrastructure errors (Drizzle, Postgres, etc.) are:
 * 1. Logged to console with full cause chain
 * 2. Reported to PostHog server-side (preserving .cause)
 * 3. Replaced with a generic "An unexpected error occurred" so raw SQL never leaks
 *
 * Domain errors (NotFoundError, ConflictError, etc.) pass through unchanged.
 */
const functionErrorBoundary = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const { handleBoundaryError } = await import('@repo/domain');
  try {
    return await next();
  } catch (error) {
    throw handleBoundaryError(error, { source: 'server-function' });
  }
});

/**
 * Global error boundary for all API route handlers (createFileRoute server.handlers).
 *
 * Catches unhandled exceptions that escape individual route handlers — for example, an
 * infra error thrown by auth.api.getSession() before the handler has a chance to catch it.
 * Returns a generic 500 JSON response so raw SQL / internals never reach the client.
 *
 * Routes that need finer-grained error mapping (e.g. /api/feeds) should catch domain errors
 * themselves before this boundary sees them.
 */
const requestErrorBoundary = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  const { handleBoundaryError } = await import('@repo/domain');
  try {
    return await next();
  } catch (error) {
    const handled = handleBoundaryError(error, { source: 'api-route' });
    return new Response(JSON.stringify({ message: handled.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [functionErrorBoundary],
  requestMiddleware: [requestErrorBoundary],
}));
