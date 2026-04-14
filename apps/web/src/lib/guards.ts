import { redirect } from '@tanstack/solid-router';
import { isServer } from 'solid-js/web';

// See docs/auth-guards.md for the full auth guard architecture.

async function hasSession(): Promise<boolean> {
  const { auth } = await import('~/server/auth.server');
  const { captureException, UnexpectedError } = await import('@repo/domain');
  const { getRequestHeaders } = await import('@tanstack/solid-start/server');
  const headers = getRequestHeaders();
  try {
    const session = await auth.api.getSession({ headers });
    return !!session;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    captureException(err, { source: 'auth-guard', type: 'getSession' });
    throw new UnexpectedError();
  }
}

interface BeforeLoadContext {
  location?: { pathname: string; searchStr: string };
}

/**
 * Guard for protected routes. Redirects unauthenticated users to /login.
 * Skips on client navigations — server middleware is the security gate.
 */
export async function authGuard(ctx?: BeforeLoadContext) {
  if (!isServer) return;
  if (await hasSession()) return;
  const location = ctx?.location;
  const redirectPath = location ? location.pathname + location.searchStr : undefined;
  const search = redirectPath && redirectPath !== '/' ? { redirect: redirectPath } : undefined;
  throw redirect({ to: '/login', search });
}

/**
 * Guard for guest-only routes (login, signup, etc).
 * Redirects authenticated users to /.
 * Skips on client navigations.
 */
export async function guestGuard(_ctx?: BeforeLoadContext) {
  if (!isServer) return;
  if (await hasSession()) {
    throw redirect({ to: '/' });
  }
}
