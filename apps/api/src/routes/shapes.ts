import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client';
import { captureException } from '@repo/domain';
import { Elysia } from 'elysia';
import { env } from '~/env';
import { authPlugin, requireUser } from '~/middleware/auth';

/**
 * Electric SQL proxy. Forwards a shape request to the Electric service,
 * scoping it server-side to the authenticated user.
 *
 * Ported from apps/web/src/lib/electric-proxy.server.ts — same logic,
 * just expressed as an Elysia handler.
 */
async function proxyElectricRequest(opts: {
  request: Request;
  table: string;
  userId: string;
}): Promise<Response> {
  const { request, table, userId } = opts;
  const url = new URL(request.url);

  const originUrl = new URL(`${env.ELECTRIC_URL}/v1/shape`);

  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value);
    }
  });

  originUrl.searchParams.set('table', table);
  originUrl.searchParams.set('where', 'user_id = $1');
  originUrl.searchParams.set('params[1]', userId);

  if (env.ELECTRIC_SOURCE_ID) {
    originUrl.searchParams.set('source_id', env.ELECTRIC_SOURCE_ID);
    originUrl.searchParams.set('source_secret', env.ELECTRIC_SOURCE_SECRET!);
  }

  let response: Response;
  try {
    response = await fetch(originUrl, { signal: request.signal });
  } catch (error) {
    const fetchError = error instanceof Error ? error : new Error(String(error));
    if (fetchError.name === 'AbortError' || request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    captureException(fetchError, {
      userId,
      source: 'electric-proxy',
      table,
      errorType: 'fetch_throw',
    });
    throw fetchError;
  }

  if (response.status >= 500) {
    captureException(new Error(`Electric proxy upstream ${response.status}`), {
      userId,
      source: 'electric-proxy',
      table,
      errorType: 'upstream_error',
      upstreamStatus: response.status,
    });
  }

  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.set('Vary', 'Cookie');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const shapesRoutes = new Elysia({ prefix: '/api2/shapes' })
  .use(authPlugin)
  .get('/settings', ({ request, user }) => {
    requireUser(user);
    return proxyElectricRequest({ request, table: 'settings', userId: user.id });
  });
