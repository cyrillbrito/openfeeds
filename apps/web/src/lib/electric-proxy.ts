import { ELECTRIC_PROTOCOL_QUERY_PARAMS } from '@electric-sql/client';
import { env } from '~/env';

interface ProxyShapeOptions {
  /** The incoming request object */
  request: Request;
  /** The database table name to sync */
  table: string;
  /** SQL WHERE clause to filter rows (e.g., `user_id = '${userId}'`) */
  where?: string;
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
  where,
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

  // Set the where clause if provided
  if (where) {
    originUrl.searchParams.set('where', where);
  }

  // Append Electric Cloud credentials if configured
  if (env.ELECTRIC_SOURCE_ID) {
    originUrl.searchParams.set('source_id', env.ELECTRIC_SOURCE_ID);
    originUrl.searchParams.set('source_secret', env.ELECTRIC_SOURCE_SECRET!);
  }

  const response = await fetch(originUrl);

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
