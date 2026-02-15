/**
 * Development-only CORS middleware for the server entry fetch handler.
 *
 * Wraps a fetch function to add permissive CORS headers in development,
 * allowing MCP Inspector and other local tools to connect without a proxy.
 *
 * In production this is a no-op passthrough. The `process.env.NODE_ENV` check
 * enables bundlers (Vite/Rollup) to tree-shake the CORS logic entirely from
 * production builds.
 */

type FetchFn = (request: Request) => Response | Promise<Response>;

const DEV_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id, Mcp-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};

export function withDevCors(fetchFn: FetchFn): FetchFn {
  if (process.env.NODE_ENV !== 'development') return fetchFn;

  return async (request: Request) => {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: DEV_CORS_HEADERS });
    }

    const response = await fetchFn(request);

    for (const [key, value] of Object.entries(DEV_CORS_HEADERS)) {
      response.headers.set(key, value);
    }

    return response;
  };
}
