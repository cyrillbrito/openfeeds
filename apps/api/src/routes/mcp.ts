import { mcpHandler } from '@better-auth/oauth-provider';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '~/env';
import type { Env } from '~/middleware/auth';

/**
 * MCP endpoint (Streamable HTTP transport).
 *
 * Mounted at `/api/mcp/*` on the api app. External MCP clients connect to
 * `${BASE_URL}/api/mcp` (the public origin); in dev this resolves through
 * the web Vite proxy.
 *
 * JWKS resolution: defaults to `${BASE_URL}/api/auth/jwks`. Set
 * `AUTH_JWKS_URL` to bypass DNS/TLS (e.g., point at the in-process
 * localhost mount) and avoid a network self-fetch.
 *
 * Stateless mode: a fresh transport + server is created per request.
 * Currently registers a single "hello" tool for testing the OAuth flow.
 */
const handler = mcpHandler(
  {
    jwksUrl: env.AUTH_JWKS_URL ?? `${env.BASE_URL}/api/auth/jwks`,
    verifyOptions: {
      audience: `${env.BASE_URL}/api/mcp`,
      issuer: `${env.BASE_URL}/api/auth`,
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

export const mcpRoutes = new Hono<Env>().all('/*', (c) => handler(c.req.raw));
