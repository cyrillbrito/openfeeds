import type { auth } from '~/server/auth.server';
import { redirect } from '@tanstack/solid-router';
import { createMiddleware } from '@tanstack/solid-start';
import { getRequestHeaders } from '@tanstack/solid-start/server';

type InferredSession = typeof auth.$Infer.Session;
export type AuthContext = { user: InferredSession['user']; session: InferredSession['session'] };

/**
 * Function middleware for server functions (createServerFn)
 * Redirects to login page if not authenticated.
 * Distinguishes between "no session" (redirect) and "session check failed" (re-throw).
 */
export const authMiddleware = createMiddleware().server(async ({ request, next }) => {
  const { auth } = await import('~/server/auth.server');
  const { captureException } = await import('@repo/domain');
  const headers = getRequestHeaders();

  let session;
  try {
    session = await auth.api.getSession({ headers });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    captureException(err, { source: 'auth-middleware', type: 'getSession' });
    throw error;
  }

  if (!session) {
    const url = new URL(request.url);
    const redirectPath = url.pathname + url.search;
    // Only include redirect param if it's a meaningful path (not just "/")
    const search = redirectPath && redirectPath !== '/' ? { redirect: redirectPath } : undefined;
    throw redirect({ to: '/login', search });
  }
  return next({ context: { user: session.user, session: session.session } as AuthContext });
});

/**
 * Server middleware for guest-only pages (login, signup, forgot-password, reset-password)
 * Redirects authenticated users to the app root
 */
export const guestMiddleware = createMiddleware().server(async ({ next }) => {
  const { auth } = await import('~/server/auth.server');
  const { captureException } = await import('@repo/domain');
  const headers = getRequestHeaders();

  let session;
  try {
    session = await auth.api.getSession({ headers });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    captureException(err, { source: 'guest-middleware', type: 'getSession' });
    throw error;
  }

  if (session) {
    throw redirect({ to: '/' });
  }
  return next();
});

/**
 * Request middleware for API route handlers (createFileRoute server.handlers)
 * Returns 401 Unauthorized if not authenticated.
 * Reports infrastructure errors to PostHog instead of masking as 401.
 */
export const authRequestMiddleware = createMiddleware({ type: 'request' }).server<AuthContext>(
  async ({ request, next }) => {
    const { auth } = await import('~/server/auth.server');
    const { captureException } = await import('@repo/domain');

    let session;
    try {
      session = await auth.api.getSession({ headers: request.headers });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureException(err, { source: 'auth-request-middleware', type: 'getSession' });
      return new Response(JSON.stringify({ message: 'An unexpected error occurred' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!session) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return next({ context: { user: session.user, session: session.session } });
  },
);
