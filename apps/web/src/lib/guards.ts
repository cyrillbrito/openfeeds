import { redirect } from '@tanstack/react-router';
import { getSessionOnce } from './session';

// See docs/auth-guards.md for the full auth guard architecture.

interface Location {
  pathname: string;
  searchStr: string;
}

/**
 * Guard for protected routes. Redirects unauthenticated users to /login.
 *
 * Reads the cached session promise from `~/lib/session`.
 * The first guard call on a cold load triggers one `get-session` request; every
 * subsequent navigation awaits the same memoized promise (no network).
 */
export async function authGuard(location?: Location): Promise<void> {
  const session = await getSessionOnce();
  if (session) return;
  const redirectPath = location ? location.pathname + location.searchStr : undefined;
  const search = redirectPath && redirectPath !== '/' ? { redirect: redirectPath } : undefined;
  throw redirect({ to: '/login', search });
}

/**
 * Guard for guest-only routes (login, signup, etc).
 * Redirects authenticated users to /.
 */
export async function guestGuard(): Promise<void> {
  const session = await getSessionOnce();
  if (session) {
    throw redirect({ to: '/' });
  }
}
