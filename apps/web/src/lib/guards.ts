import { redirect } from '@tanstack/solid-router';
import { createIsomorphicFn } from '@tanstack/solid-start';
import { getRequestHeaders } from '@tanstack/solid-start/server';
import posthog from 'posthog-js';
import { authClient } from '~/lib/auth-client';

export const hasSession = createIsomorphicFn()
  .server(async () => {
    const { auth } = await import('~/server/auth.server');
    const { captureException } = await import('@repo/domain');
    const headers = getRequestHeaders();
    try {
      const session = await auth.api.getSession({ headers });
      return !!session;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      captureException(err, { source: 'auth-guard', type: 'getSession' });
      throw error;
    }
  })
  .client(async () => {
    try {
      const sessionData = await authClient.getSession();
      if (sessionData.error) {
        throw sessionData.error instanceof Error
          ? sessionData.error
          : new Error(String(sessionData.error));
      }
      return !!sessionData.data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      posthog.captureException(err);
      throw err;
    }
  });

/**
 * Guard for protected routes. Redirects unauthenticated users to /login.
 * Optionally preserves the original path as a ?redirect= search param.
 */
export async function authGuard(location?: { pathname: string; searchStr: string }) {
  if (await hasSession()) return;
  const redirectPath = location ? location.pathname + location.searchStr : undefined;
  const search = redirectPath && redirectPath !== '/' ? { redirect: redirectPath } : undefined;
  throw redirect({ to: '/login', search });
}

/**
 * Guard for guest-only routes (login, signup, etc).
 * Redirects authenticated users to /.
 */
export async function guestGuard() {
  if (await hasSession()) {
    throw redirect({ to: '/' });
  }
}
