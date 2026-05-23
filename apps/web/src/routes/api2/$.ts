import { createFileRoute } from '@tanstack/solid-router';
import { env } from '~/env';

/**
 * /api2/* — catch-all proxy to the Elysia server in apps/api/.
 *
 * TanStack Start's Nitro middleware claims the entire dev-server HTTP layer
 * and prevents Vite's `server.proxy` from working. Instead of fighting that,
 * we register a Start route that explicitly forwards everything under /api2
 * to Elysia.
 *
 * Result: browser sees a single origin (works over Tailscale tunnels), no
 * CORS, Better Auth cookies forwarded automatically. Once Start is removed
 * entirely we can drop this file and rename /api2 → /api on the Elysia side.
 *
 * In production, this should be replaced by a real reverse proxy in front
 * of both services — but the contract is identical.
 */

async function forward({ request }: { request: Request }): Promise<Response> {
  const url = new URL(request.url);
  const upstream = new URL(url.pathname + url.search, env.API_ORIGIN);

  // Recreate the request against the upstream URL.
  // `duplex: 'half'` is required by undici when streaming a body.
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers: request.headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    signal: request.signal,
    redirect: 'manual',
    duplex: 'half',
  };

  let response: Response;
  try {
    response = await fetch(upstream, init);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    // Client disconnected — normal for SSE / long-polls.
    if (err.name === 'AbortError' || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    return new Response(JSON.stringify({ message: 'API gateway error', detail: err.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Strip hop-by-hop headers; let the response body stream through.
  // Also drop content-encoding / content-length because fetch decompresses
  // on the way in but doesn't rewrite those headers.
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('transfer-encoding');
  headers.delete('connection');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const Route = createFileRoute('/api2/$')({
  server: {
    handlers: {
      GET: forward,
      POST: forward,
      PUT: forward,
      PATCH: forward,
      DELETE: forward,
      OPTIONS: forward,
      HEAD: forward,
    },
  },
});
