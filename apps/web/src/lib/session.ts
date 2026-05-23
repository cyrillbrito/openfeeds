import { authClient } from './auth-client';

/**
 * SPA session cache.
 *
 * A single in-memory promise that resolves to the current Better Auth session
 * (or `null` for guests). Used by route guards so navigation never spams the
 * api with `get-session` requests — the first guard to run triggers one fetch,
 * every subsequent guard awaits the already-resolved promise synchronously.
 *
 * Lifecycle:
 * - Cold app load → first call to `getSessionOnce()` fires one network request.
 * - All subsequent calls return the same memoized promise.
 * - `setSession(...)` lets the login/signup flows seed the cache after a
 *   successful sign-in so the next guard run sees the new session without
 *   a refetch.
 * - `invalidateSession()` clears the cache (used on sign-out — though the
 *   sign-out handler also does a full reload, this keeps the helpers honest
 *   for any future in-place flow).
 *
 * The shape is intentionally narrow: guards only need to know "is there a
 * session?". Components that need user details continue to use Better Auth's
 * `useSession()` reactive hook — which already shares the same underlying
 * fetch via `better-auth/solid` and stays in sync with this cache because
 * Better Auth's client maintains its own internal cache.
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
