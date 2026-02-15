import { mcpHandler } from '@better-auth/oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createFileRoute } from '@tanstack/solid-router';
import { z } from 'zod';
import { env } from '~/env';

/**
 * MCP endpoint (Streamable HTTP transport) at /api/mcp.
 *
 * Uses mcpHandler from @better-auth/oauth-provider for JWT verification,
 * and the MCP SDK's WebStandardStreamableHTTPServerTransport directly.
 *
 * Stateless mode: a fresh transport + server is created per request.
 * Currently registers a single "hello" tool for testing the OAuth flow.
 */

/**
 * The JWKS URL uses localhost to avoid the server fetching itself through
 * the public URL (DNS, TLS, potential deadlocks). Nitro reads PORT from
 * the environment at runtime, defaulting to 3000.
 *
 * TODO: If mcpHandler ever supports in-process JWKS resolution (e.g. a
 * `jwksFetch` callback instead of `jwksUrl`), switch to that to eliminate
 * the self-fetch entirely.
 */
const port = process.env.PORT ?? 3000;

const handler = mcpHandler(
  {
    jwksUrl: `http://localhost:${port}/api/auth/jwks`,
    verifyOptions: {
      audience: `${env.BASE_URL}/api/mcp`,
      issuer: env.BASE_URL,
    },
    scopes: ['mcp:tools'],
  },
  async (req, jwt) => {
    const server = new McpServer({ name: 'OpenFeeds', version: '0.0.1' });

    server.registerTool(
      'hello',
      {
        description: 'A simple hello world tool for testing the OAuth flow',
        inputSchema: { name: z.string().optional().describe('Name to greet') },
      },
      async ({ name }) => ({
        content: [
          {
            type: 'text' as const,
            text: `Hello, ${name ?? 'world'}! You are authenticated as user ${jwt.sub ?? 'unknown'}.`,
          },
        ],
      }),
    );

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
