import { redirect } from '@tanstack/solid-router';
import { createIsomorphicFn } from '@tanstack/solid-start';

// See docs/auth-guards.md for the full auth guard architecture.

interface Location {
  pathname: string;
  searchStr: string;
}

/**
 * Guard for protected routes. Redirects unauthenticated users to /login.
 * Skips on client navigations — server middleware is the security gate.
 */
export const authGuard = createIsomorphicFn()
  .client((_location?: Location) => {
    // No-op on client — server middleware is the security gate.
  })
  .server(async (location?: Location) => {
    const { hasSession } = await import('~/server/has-session.server');
    if (await hasSession()) return;
    const redirectPath = location ? location.pathname + location.searchStr : undefined;
    const search = redirectPath && redirectPath !== '/' ? { redirect: redirectPath } : undefined;
    throw redirect({ to: '/login', search });
  });

/**
 * Guard for guest-only routes (login, signup, etc).
 * Redirects authenticated users to /.
 * Skips on client navigations.
 */
export const guestGuard = createIsomorphicFn()
  .client(() => {
    // No-op on client — server middleware is the security gate.
  })
  .server(async () => {
    const { hasSession } = await import('~/server/has-session.server');
    if (await hasSession()) {
      throw redirect({ to: '/' });
    }
  });
