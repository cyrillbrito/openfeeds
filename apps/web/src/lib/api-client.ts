import type { App } from '@repo/server/client';
import { hc } from 'hono/client';
import type { ClientResponse } from 'hono/client';

/**
 * Hono RPC client — end-to-end typed access to the Hono API in apps/server/.
 *
 * Same-origin in the browser via Vite's `server.proxy: { '/api': ... }`
 * (dev) and a reverse proxy in prod. No CORS, no cookie domain issues,
 * works over Tailscale tunnels.
 *
 * `import type` ensures none of Hono/Better Auth/drizzle is bundled into
 * the client — only TypeScript types travel across the boundary.
 *
 * ## Usage
 *
 * Raw — when you need to branch on status codes or stream a body:
 *
 *   const res = await api.api.feeds.create.$post({ json: feeds });
 *   if (!res.ok) {
 *     const { message } = await res.json();
 *     throw new Error(message);
 *   }
 *   return await res.json();
 *
 * With `unwrap()` — for the common case of "throw on !ok, return parsed body":
 *
 *   return await unwrap(api.api.feeds.create.$post({ json: feeds }));
 */
export const api = hc<App>(window.location.origin, {
  fetch: ((input, init) => fetch(input, { ...init, credentials: 'include' })) as typeof fetch,
});

/**
 * Pull the JSON body type out of the success branch(es) of a Hono
 * `ClientResponse<T, S, F>` union. We `Extract` only the 2xx members so the
 * caller doesn't have to widen with `!res.ok` checks.
 */
type SuccessBody<R> =
  R extends ClientResponse<infer T, infer S, 'json'>
    ? S extends 200 | 201 | 202 | 204
      ? T
      : never
    : never;

/**
 * Throw on non-2xx, parse JSON otherwise.
 *
 * The error message is pulled from the response body's `message` field when
 * present (every Hono route is wired to return `{ message }` on error via
 * the central `app.onError`). Falls back to status text.
 */
export async function unwrap<R extends ClientResponse<unknown>>(
  promise: Promise<R>,
): Promise<SuccessBody<R>> {
  const res = await promise;
  if (!res.ok) {
    let message = res.statusText || `Request failed with status ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body && typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // body was not JSON or already consumed — fall back to statusText
    }
    throw new Error(message);
  }
  return (await res.json()) as SuccessBody<R>;
}
