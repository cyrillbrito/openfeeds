import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client';
import { captureException } from '@repo/domain';
import { Hono } from 'hono';
import { env } from '~/env';
import { requireAuthMiddleware, type AuthedEnv } from '~/middleware/auth';

/**
 * Electric SQL proxy. Forwards a shape request to the Electric service,
 * scoping it server-side to the authenticated user. Returns the upstream
 * `Response` unchanged (Hono passes through any returned `Response`), so
 * the streaming shape log body is forwarded straight to the browser
 * without re-buffering.
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

/**
 * Shape proxy router. Routes are chained on a single Hono instance so the
 * exported type carries every route into `hc<App>` on the client.
 *
 * URL path is kebab-case (matches `apps/web/src/lib/electric-client.ts` →
 * `getShapeUrl(model)`); DB table is snake_case.
 */
export const shapesRoutes = new Hono<AuthedEnv>()
  .use('*', requireAuthMiddleware)
  .get('/settings', (c) => {
    const user = c.var.user;
    return proxyElectricRequest({ request: c.req.raw, table: 'settings', userId: user.id });
  })
  .get('/articles', (c) => {
    const user = c.var.user;
    return proxyElectricRequest({ request: c.req.raw, table: 'articles', userId: user.id });
  })
  .get('/article-tags', (c) => {
    const user = c.var.user;
    return proxyElectricRequest({ request: c.req.raw, table: 'article_tags', userId: user.id });
  })
  .get('/chat-sessions', (c) => {
    const user = c.var.user;
    return proxyElectricRequest({ request: c.req.raw, table: 'chat_sessions', userId: user.id });
  })
  .get('/feeds', (c) => {
    const user = c.var.user;
    return proxyElectricRequest({ request: c.req.raw, table: 'feeds', userId: user.id });
  })
  .get('/feed-tags', (c) => {
    const user = c.var.user;
    return proxyElectricRequest({ request: c.req.raw, table: 'feed_tags', userId: user.id });
  })
  .get('/filter-rules', (c) => {
    const user = c.var.user;
    return proxyElectricRequest({ request: c.req.raw, table: 'filter_rules', userId: user.id });
  })
  .get('/tags', (c) => {
    const user = c.var.user;
    return proxyElectricRequest({ request: c.req.raw, table: 'tags', userId: user.id });
  });
