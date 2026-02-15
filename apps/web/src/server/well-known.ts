import {
  oauthProviderAuthServerMetadata,
  oauthProviderOpenIdConfigMetadata,
} from '@better-auth/oauth-provider';
import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client';
import { NotFoundError } from '@repo/domain';
import { createAuthClient } from 'better-auth/client';
import { env } from '~/env';
import { auth } from './auth';

const handleOpenIdConfig = oauthProviderOpenIdConfigMetadata(auth);
const handleAuthServer = oauthProviderAuthServerMetadata(auth);

const protectedResourceClient = createAuthClient({
  plugins: [oauthProviderResourceClient(auth)],
});

async function handleProtectedResource(_request: Request): Promise<Response> {
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
}

export async function handleWellKnown(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // OpenID Connect Discovery — served at root
  if (path === '/.well-known/openid-configuration') {
    return handleOpenIdConfig(request);
  }

  // OAuth 2.0 Authorization Server Metadata (RFC 8414)
  if (
    path === '/.well-known/oauth-authorization-server' ||
    path === '/.well-known/oauth-authorization-server/api/auth'
  ) {
    return handleAuthServer(request);
  }

  // OAuth 2.0 Protected Resource Metadata (RFC 9728)
  if (path === '/.well-known/oauth-protected-resource') {
    return handleProtectedResource(request);
  }

  throw new NotFoundError();
}
