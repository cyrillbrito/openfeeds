import { captureException } from '@repo/domain';
import { redirect } from '@tanstack/solid-router';
import { createIsomorphicFn } from '@tanstack/solid-start';
import { getRequestHeaders } from '@tanstack/solid-start/server';
import posthog from 'posthog-js';
import { authClient } from '~/lib/auth-client';
import { auth } from '~/server/auth';

export const hasSession = createIsomorphicFn()
  .server(async () => {
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
      return !!sessionData.data;
    } catch (error) {
      posthog.captureException(error);
      throw error;
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
