// The app's authorization boundary.
//
// Every server function in src/lib/feeds.ts starts here, and the userId it
// returns is what scopes the query. Nothing below reads a user id from
// arguments: it comes from the session cookie, so a client cannot ask for
// another user's data by changing a parameter.
import 'server-only';

import { getRequestEvent, redirect } from '@solidjs/web';

import { auth } from './auth';

/** The signed-in user, or null. */
export async function currentUser() {
  const session = await auth.api.getSession({
    headers: getRequestEvent()!.request.headers,
  });
  return session?.user ?? null;
}

/**
 * The signed-in user's id, or a redirect to /signin.
 *
 * Thrown, not returned: a query that throws a redirect during SSR is a
 * redirect response, and the same throw from a client-side call navigates.
 */
export async function requireUserId(): Promise<string> {
  const user = await currentUser();
  if (!user) throw redirect('/signin');
  return user.id;
}
