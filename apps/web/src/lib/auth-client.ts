// Better Auth's vanilla client, not `better-auth/solid`: the Solid client's
// `useStore` imports `solid-js/store`, a subpath Solid 2 does not export.
// No baseURL needed — the auth routes are same-origin.
import { query } from '@solidjs/router';
import { createAuthClient } from 'better-auth/client';
import { getRequestEvent } from '@solidjs/web';

import { auth, googleEnabled } from '../server/auth';

export const authClient = createAuthClient();

export const { signIn, signUp, signOut } = authClient;

/** The current user, or null. Read on the server from the request cookie. */
export const getUser = query(async () => {
  'use server';
  const session = await auth.api.getSession({
    headers: getRequestEvent()!.request.headers,
  });
  return session?.user ?? null;
}, 'auth-user');

/** Whether this deployment configured Google. */
export const getGoogleEnabled = query(async () => {
  'use server';
  return googleEnabled;
}, 'auth-google');
