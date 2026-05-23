import { authClient } from './auth-client';

/**
 * SPA session cache.
 *
 * Better Auth's `authClient.getSession()` is a dynamic-proxy method that
 * always fires a fresh `/api/auth/get-session` request — its reactive
 * `useSession()` atom is the only thing it dedupes through. Route guards
 * (`~/lib/guards`) cannot wait for the atom to settle, so this module
 * memoizes a single promise: first guard on a cold load triggers one fetch,
 * every subsequent guard awaits the same promise.
 *
 * Lifecycle:
 * - Cold app load → first `getSessionOnce()` fires one network request.
 * - All subsequent calls return the same memoized promise.
 * - `primeSessionAfterAuth()` seeds the cache after a successful login/signup
 *   so the post-redirect guard run sees the session without a refetch.
 * - `invalidateSession()` clears the cache on sign-out (the sign-out handler
 *   also does a full page reload, which independently nukes everything;
 *   the explicit clear keeps the helper honest for any future in-place flow).
 *
 * The shape is intentionally narrow: guards only need to know "is there a
 * session?". Components that need user details use Better Auth's reactive
 * `useSession()` hook.
 */

type SessionData = Awaited<ReturnType<typeof authClient.getSession>>['data'];

let cached: Promise<SessionData> | null = null;

export function getSessionOnce(): Promise<SessionData> {
  cached ??= authClient.getSession().then((res) => res.data ?? null);
  return cached;
}

export function setSession(data: SessionData): void {
  cached = Promise.resolve(data);
}

export function invalidateSession(): void {
  cached = null;
}

/**
 * Seed the cache after a successful login/signup and return the session data
 * (or null when verification is still pending).
 *
 * The reactive `useSession()` atom in `_frame.tsx` separately picks up the
 * user and fires `posthog.identify()` — callers do not need to identify here.
 */
export async function primeSessionAfterAuth(): Promise<SessionData> {
  const { data } = await authClient.getSession();
  setSession(data ?? null);
  return data ?? null;
}
