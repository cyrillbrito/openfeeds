import { initDb } from '@repo/db';
import { initDomain } from '@repo/domain';
import handler, { createServerEntry } from '@tanstack/solid-start/server-entry';
import { env } from './env';
import {
  handleAuthServerMetadata,
  handleMcpRequest,
  handleOpenIdConfig,
  handleProtectedResourceMetadata,
} from './server/mcp/handler';

// Initialize packages with config from environment
// Note: initDb must be called before initDomain
initDb({ databaseUrl: env.DATABASE_URL });

initDomain({
  dataPath: env.DATA_PATH,
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },
  posthogKey: env.POSTHOG_PUBLIC_KEY,
  posthogApp: 'server',
  resendApiKey: env.RESEND_API_KEY,
  unrealSpeechApiKey: env.UNREAL_SPEECH_API_KEY,
  ttsDefaultVoice: env.TTS_DEFAULT_VOICE,
});

export default createServerEntry({
  fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // MCP endpoint (Streamable HTTP transport)
    if (path === '/api/mcp') {
      return handleMcpRequest(request);
    }

    // OAuth Protected Resource Metadata (RFC 9728)
    // MCP clients fetch this to discover the authorization server
    if (path === '/.well-known/oauth-protected-resource') {
      return handleProtectedResourceMetadata();
    }

    // OAuth Authorization Server Metadata (RFC 8414)
    // The issuer is at /api/auth, so per RFC 8414 path insertion:
    // /.well-known/oauth-authorization-server/api/auth
    if (
      path === '/.well-known/oauth-authorization-server' ||
      path === '/.well-known/oauth-authorization-server/api/auth'
    ) {
      return handleAuthServerMetadata(request);
    }

    // OpenID Connect Discovery (at issuer path)
    if (path === '/.well-known/openid-configuration') {
      return handleOpenIdConfig(request);
    }

    // Default TanStack Start handler
    return handler.fetch(request);
  },
});
