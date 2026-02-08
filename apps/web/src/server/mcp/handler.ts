/**
 * MCP Streamable HTTP transport handler.
 *
 * Handles POST (JSON-RPC messages), GET (SSE stream), and DELETE (session termination)
 * at /api/mcp. Authenticates via OAuth 2.1 bearer tokens using Better Auth.
 *
 * Uses WebStandardStreamableHTTPServerTransport which works natively with
 * Web API Request/Response (no Node.js adapter needed).
 */
import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyAccessToken } from 'better-auth/oauth2';
import { env } from '~/env';
import { auth } from '~/server/auth';
import { registerTools } from './tools';

// In-memory session store for active MCP transports
const transports: Map<string, WebStandardStreamableHTTPServerTransport> = new Map();

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'OpenFeeds',
    version: '1.0.0',
  });
  registerTools(server);
  return server;
}

/**
 * Extract and verify the OAuth bearer token from the request.
 * Returns AuthInfo compatible with the MCP SDK if valid, null otherwise.
 */
async function authenticateRequest(request: Request): Promise<AuthInfo | null> {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice(7);

  try {
    const payload = await verifyAccessToken(token, {
      verifyOptions: {
        issuer: `${env.CLIENT_DOMAIN}/api/auth`,
        audience: `${env.CLIENT_DOMAIN}/api/mcp`,
      },
    });

    if (payload?.sub) {
      return {
        token,
        clientId: (payload.azp as string) ?? 'unknown',
        scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
        extra: { userId: payload.sub as string },
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a 401 response with WWW-Authenticate header pointing to the
 * protected resource metadata URL (RFC 9728).
 */
function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer realm="openfeeds", resource_metadata="${env.CLIENT_DOMAIN}/.well-known/oauth-protected-resource"`,
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  };
}

/**
 * Handle incoming requests to /api/mcp.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // Authenticate all non-OPTIONS requests
  const authInfo = await authenticateRequest(request);
  if (!authInfo) {
    return unauthorizedResponse();
  }

  const sessionId = request.headers.get('mcp-session-id') ?? undefined;

  if (method === 'GET') {
    // SSE stream for existing session
    if (!sessionId || !transports.has(sessionId)) {
      return new Response('Invalid or missing session ID', {
        status: 400,
        headers: corsHeaders(),
      });
    }
    const transport = transports.get(sessionId)!;
    return transport.handleRequest(request, { authInfo });
  }

  if (method === 'POST') {
    let transport: WebStandardStreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Existing session
      transport = transports.get(sessionId)!;
    } else if (!sessionId) {
      // Potentially a new session (initialize request)
      transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (newSessionId) => {
          transports.set(newSessionId, transport);
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          transports.delete(transport.sessionId);
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
    } else {
      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders() } },
      );
    }

    return transport.handleRequest(request, { authInfo });
  }

  if (method === 'DELETE') {
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.close();
      transports.delete(sessionId);
    }
    return new Response(null, { status: 200, headers: corsHeaders() });
  }

  return new Response('Method not allowed', { status: 405, headers: corsHeaders() });
}

/**
 * Handle well-known OAuth protected resource metadata (RFC 9728).
 * This tells MCP clients where to find the authorization server.
 * Not provided by @better-auth/oauth-provider, so we build it manually.
 */
export function handleProtectedResourceMetadata(): Response {
  const baseUrl = env.CLIENT_DOMAIN;

  const metadata = {
    resource: `${baseUrl}/api/mcp`,
    authorization_servers: [`${baseUrl}/api/auth`],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'mcp:tools'],
    resource_name: 'OpenFeeds',
    resource_documentation: baseUrl,
  };

  return new Response(JSON.stringify(metadata), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=15, stale-while-revalidate=15, stale-if-error=86400',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    },
  });
}

/**
 * Handle OAuth Authorization Server metadata (RFC 8414).
 * Delegates to @better-auth/oauth-provider to stay in sync with the auth config.
 */
export const handleAuthServerMetadata = oauthProviderAuthServerMetadata(auth, {
  headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' },
});

/**
 * Handle OpenID Connect Discovery metadata.
 * Delegates to @better-auth/oauth-provider to stay in sync with the auth config.
 */
export const handleOpenIdConfig = oauthProviderOpenIdConfigMetadata(auth, {
  headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' },
});
