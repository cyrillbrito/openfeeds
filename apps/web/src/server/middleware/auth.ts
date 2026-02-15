import { redirect } from '@tanstack/solid-router';
import { createMiddleware } from '@tanstack/solid-start';
import { getRequestHeaders } from '@tanstack/solid-start/server';
import type { Session, User } from 'better-auth';

// Lazy import to avoid leaking @repo/db into client bundle.
// TanStack Start's DCE doesn't fully eliminate middleware imports (TanStack/router#2783).
const getAuth = () => import('~/server/auth').then((m) => m.auth);

export type AuthContext = { user: User; session: Session };

/**
 * Function middleware for server functions (createServerFn)
 * Redirects to login page if not authenticated
 */
export const authMiddleware = createMiddleware().server(async ({ request, next }) => {
  const auth = await getAuth();
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
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
  const auth = await getAuth();
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (session) {
    throw redirect({ to: '/' });
  }
  return next();
});

/**
 * Request middleware for API route handlers (createFileRoute server.handlers)
 * Returns 401 Unauthorized if not authenticated
 */
export const authRequestMiddleware = createMiddleware({ type: 'request' }).server<AuthContext>(
  async ({ request, next }) => {
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return next({ context: { user: session.user, session: session.session } });
  },
);
