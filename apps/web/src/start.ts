import { handleBoundaryError } from '@repo/domain';
import { createMiddleware, createStart } from '@tanstack/solid-start';

/**
 * Global error boundary for all server functions.
 *
 * Catches errors after all per-function middleware (auth, validation) and the handler
 * have executed. Infrastructure errors (Drizzle, Postgres, etc.) are:
 * 1. Logged to console with full cause chain
 * 2. Reported to PostHog server-side (preserving .cause)
 * 3. Replaced with a generic "An unexpected error occurred" so raw SQL never leaks
 *
 * Domain errors (NotFoundError, ConflictError, etc.) pass through unchanged.
 */
const errorBoundary = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    throw handleBoundaryError(error, { source: 'server-function' });
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [errorBoundary],
}));
