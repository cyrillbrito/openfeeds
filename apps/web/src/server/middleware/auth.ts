import { redirect } from '@tanstack/solid-router';
import { createMiddleware } from '@tanstack/solid-start';
import { getRequestHeaders } from '@tanstack/solid-start/server';
import type { Session, User } from 'better-auth';
import { auth } from '~/server/auth';

export type AuthContext = { user: User; session: Session };

/**
 * Function middleware for server functions (createServerFn)
 * Redirects to signin page if not authenticated
 */
export const authMiddleware = createMiddleware().server(async ({ request, next }) => {
  const headers = getRequestHeaders();
  const session = await auth.api.getSession({ headers });
  if (!session) {
    const url = new URL(request.url);
    throw redirect({
      to: '/signin',
      search: { redirect: url.pathname + url.search },
    });
  }
  return next({ context: { user: session.user, session: session.session } as AuthContext });
});

/**
 * Request middleware for API route handlers (createFileRoute server.handlers)
 * Returns 401 Unauthorized if not authenticated
 */
export const authRequestMiddleware = createMiddleware({ type: 'request' }).server<AuthContext>(
  async ({ request, next }) => {
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
