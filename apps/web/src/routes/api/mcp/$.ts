import { mcpHandler } from '@better-auth/oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createFileRoute } from '@tanstack/solid-router';
import { env } from '~/env';
import { registerTools } from '~/mcp/register';

/**
 * MCP endpoint (Streamable HTTP transport) at /api/mcp.
 *
 * Uses mcpHandler from @better-auth/oauth-provider for JWT verification,
 * and the MCP SDK's WebStandardStreamableHTTPServerTransport directly.
 *
 * Stateless mode: a fresh transport + server is created per request.
 * Tools are registered in src/mcp/ and wired via registerTools().
 */

/**
 * The JWKS URL uses localhost to avoid the server fetching itself through
 * the public URL (DNS, TLS, potential deadlocks).
 *
 * TODO: If mcpHandler ever supports in-process JWKS resolution (e.g. a
 * `jwksFetch` callback instead of `jwksUrl`), switch to that to eliminate
 * the self-fetch entirely.
 */
const handler = mcpHandler(
  {
    jwksUrl: `http://localhost:${env.PORT}/api/auth/jwks`,
    verifyOptions: {
      audience: `${env.BASE_URL}/api/mcp`,
      issuer: `${env.BASE_URL}/api/auth`,
    },
    scopes: ['mcp:tools'],
  },
  async (req, jwt) => {
    const server = new McpServer({ name: 'OpenFeeds', version: '0.0.1' });

    registerTools(server, jwt.sub ?? '');

    const transport = new WebStandardStreamableHTTPServerTransport();
    await server.connect(transport);
    return transport.handleRequest(req);
  },
);

export const Route = createFileRoute('/api/mcp/$')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
      DELETE: ({ request }) => handler(request),
      OPTIONS: ({ request }) => handler(request),
    },
  },
});
