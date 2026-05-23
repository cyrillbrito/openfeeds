import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client';
import { createAuthClient } from 'better-auth/client';
import type { Auth } from 'better-auth/types';
import { Hono } from 'hono';
import { auth } from '~/auth';
import { env } from '~/env';
import type { Env } from '~/middleware/auth';

/**
 * OAuth/OIDC discovery endpoints.
 *
 * Mounted at `/.well-known/*` on the api app (RFC 8615 mandates root-level
 * paths). Reached in dev via Vite's `'/.well-known' → :3401` proxy, in
 * prod via the public reverse proxy. URLs inside the documents advertise
 * `${BASE_URL}` so MCP clients see a single coherent issuer.
 */
const handleOpenIdConfig = oauthProviderOpenIdConfigMetadata(auth);
const handleAuthServer = oauthProviderAuthServerMetadata(auth);

const protectedResourceClient = createAuthClient({
  plugins: [oauthProviderResourceClient(auth as unknown as Auth)],
});

export const wellKnownRoutes = new Hono<Env>()
  // OpenID Connect Discovery — served at root.
  .get('/openid-configuration', (c) => handleOpenIdConfig(c.req.raw))
  // OAuth 2.0 Authorization Server Metadata (RFC 8414).
  .get('/oauth-authorization-server', (c) => handleAuthServer(c.req.raw))
  // Same metadata advertised under the issuer path (some MCP clients probe here).
  .get('/oauth-authorization-server/api/auth', (c) => handleAuthServer(c.req.raw))
  // OAuth 2.0 Protected Resource Metadata (RFC 9728).
  .get('/oauth-protected-resource', async () => {
    const metadata = await protectedResourceClient.getProtectedResourceMetadata({
      resource: `${env.BASE_URL}/api/mcp`,
      authorization_servers: [`${env.BASE_URL}/api/auth`],
    });
    return new Response(JSON.stringify(metadata), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=15, stale-if-error=86400',
      },
    });
  });
