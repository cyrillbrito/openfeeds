import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client';
import { captureException } from '@repo/domain';
import { env } from '~/env';

function isLivePollRequest(url: URL): boolean {
  return url.searchParams.get('live') === 'true';
}

interface ProxyShapeOptions {
  /** The incoming request object */
  request: Request;
  /** The database table name to sync */
  table: string;
  /** The authenticated user's ID — used to filter rows via `user_id = $1` */
  userId: string;
}

/**
 * Proxies a request to Electric SQL following the recommended auth proxy pattern.
 * @see https://electric-sql.com/docs/guides/auth#proxy-auth
 *
 * This function:
 * 1. Constructs the upstream Electric URL
 * 2. Forwards only Electric protocol parameters from the client
 * 3. Sets the table and where clause server-side (never from client)
 * 4. Streams the response back with proper header handling
 */
export async function proxyElectricRequest({
  request,
  table,
  userId,
}: ProxyShapeOptions): Promise<Response> {
  const url = new URL(request.url);

  // Construct the upstream URL
  const originUrl = new URL(`${env.ELECTRIC_URL}/v1/shape`);

  // Only pass through Electric protocol parameters
  url.searchParams.forEach((value, key) => {
    if (ELECTRIC_PROTOCOL_QUERY_PARAMS.includes(key)) {
      originUrl.searchParams.set(key, value);
    }
  });

  // Set the table server-side - not from client params
  originUrl.searchParams.set('table', table);

  // Always filter by user_id — every shape must be scoped to the authenticated user
  originUrl.searchParams.set('where', 'user_id = $1');
  originUrl.searchParams.set('params[1]', userId);

  // Append Electric Cloud credentials if configured
  if (env.ELECTRIC_SOURCE_ID) {
    originUrl.searchParams.set('source_id', env.ELECTRIC_SOURCE_ID);
    originUrl.searchParams.set('source_secret', env.ELECTRIC_SOURCE_SECRET!);
  }

  let response: Response;
  try {
    response = await fetch(originUrl);
  } catch (error) {
    // Network-level failure (DNS, connection refused, timeout, etc.)
    const fetchError = error instanceof Error ? error : new Error(String(error));
    captureException(fetchError, {
      userId,
      source: 'electric-proxy',
      table,
      isLivePoll: isLivePollRequest(url),
      errorType: 'fetch_throw',
    });
    throw fetchError; // Re-throw so the global requestErrorBoundary handles the response
  }

  // Report non-2xx responses from Electric Cloud to PostHog
  if (!response.ok) {
    // Read body for error details, then reconstruct the response stream
    const body = await response.text();
    captureException(new Error(`Electric proxy ${response.status}: ${body.slice(0, 200)}`), {
      userId,
      source: 'electric-proxy',
      table,
      isLivePoll: isLivePollRequest(url),
      errorType: 'upstream_error',
      upstreamStatus: response.status,
      upstreamBody: body.slice(0, 500),
    });

    // Still pass the error response through to the client
    const headers = new Headers(response.headers);
    headers.delete('content-encoding');
    headers.delete('content-length');
    headers.set('Vary', 'Cookie');

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  // Fetch decompresses the body but doesn't remove the
  // content-encoding & content-length headers which would
  // break decoding in the browser.
  //
  // See https://github.com/whatwg/fetch/issues/1729
  const headers = new Headers(response.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');

  // Add Vary header for cookie-based auth to ensure proper cache isolation
  headers.set('Vary', 'Cookie');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
