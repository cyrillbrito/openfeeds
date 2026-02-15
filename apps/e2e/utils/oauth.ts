import type { APIRequestContext } from '@playwright/test';

export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const AUTH_BASE = `${BASE_URL}/api/auth`;

/**
 * Discover the MCP resource URL from the server's protected resource metadata.
 * The server's `validAudiences` may differ from the test's BASE_URL (e.g. when
 * testing against localhost but the server's BASE_URL is a Tailscale hostname).
 * We cache the result so we only fetch once per test run.
 */
let _mcpResource: string | undefined;
export async function getMcpResource(request: APIRequestContext) {
  if (_mcpResource) return _mcpResource;
  const response = await request.get(`${BASE_URL}/.well-known/oauth-protected-resource`);
  const data = await response.json();
  _mcpResource = data.resource;
  return _mcpResource!;
}

/**
 * Generate a PKCE code verifier and challenge (S256).
 */
export async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = base64url(array);

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64url(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
}

/** Generate a random state string for CSRF protection. */
export function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64url(array);
}

/** Base64url encode without padding. */
function base64url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Register a public OAuth client via dynamic registration (RFC 7591).
 * No authentication needed (allowUnauthenticatedClientRegistration is enabled).
 */
export async function registerPublicClient(
  request: APIRequestContext,
  options: {
    redirectUri: string;
    clientName?: string;
    clientUri?: string;
    scope?: string;
  },
) {
  const response = await request.post(`${AUTH_BASE}/oauth2/register`, {
    data: {
      redirect_uris: [options.redirectUri],
      token_endpoint_auth_method: 'none',
      client_name: options.clientName ?? 'E2E Test Client',
      client_uri: options.clientUri,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: options.scope ?? 'openid profile email offline_access mcp:tools',
    },
  });
  return { response, data: await response.json() };
}

/**
 * Build an OAuth 2.1 authorization URL with PKCE.
 */
export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  state: string;
  resource?: string;
}) {
  const url = new URL(`${AUTH_BASE}/oauth2/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scope);
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('state', params.state);
  if (params.resource) {
    url.searchParams.set('resource', params.resource);
  }
  return url.toString();
}

/**
 * Exchange an authorization code for tokens at the token endpoint.
 */
export async function exchangeCodeForTokens(
  request: APIRequestContext,
  params: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
    resource?: string;
  },
) {
  const form: Record<string, string> = {
    grant_type: 'authorization_code',
    code: params.code,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  };
  if (params.resource) form.resource = params.resource;
  const response = await request.post(`${AUTH_BASE}/oauth2/token`, { form });
  return { response, data: await response.json() };
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(
  request: APIRequestContext,
  params: {
    refreshToken: string;
    clientId: string;
    resource?: string;
  },
) {
  const form: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId,
  };
  if (params.resource) form.resource = params.resource;
  const response = await request.post(`${AUTH_BASE}/oauth2/token`, { form });
  return { response, data: await response.json() };
}

/**
 * Send a raw MCP JSON-RPC message to the MCP endpoint.
 */
export async function sendMcpMessage(
  request: APIRequestContext,
  accessToken: string,
  message: unknown,
) {
  const response = await request.post(`${BASE_URL}/api/mcp`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    data: message,
  });
  return { response };
}

/**
 * Initialize an MCP session and call a tool.
 * Sends a JSON-RPC batch: initialize + initialized notification + tools/call.
 */
export async function mcpInitializeAndCallTool(
  request: APIRequestContext,
  accessToken: string,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const batch = [
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'e2e-test', version: '1.0.0' },
      },
    },
    {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    },
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    },
  ];

  return sendMcpMessage(request, accessToken, batch);
}

/**
 * Revoke a token (RFC 7009).
 */
export async function revokeToken(
  request: APIRequestContext,
  params: {
    token: string;
    clientId: string;
    tokenTypeHint?: 'access_token' | 'refresh_token';
  },
) {
  const formData: Record<string, string> = {
    token: params.token,
    client_id: params.clientId,
  };
  if (params.tokenTypeHint) {
    formData.token_type_hint = params.tokenTypeHint;
  }
  const response = await request.post(`${AUTH_BASE}/oauth2/revoke`, { form: formData });
  return { response };
}

/**
 * Introspect a token (RFC 7662).
 */
export async function introspectToken(
  request: APIRequestContext,
  params: {
    token: string;
    clientId: string;
    tokenTypeHint?: 'access_token' | 'refresh_token';
  },
) {
  const formData: Record<string, string> = {
    token: params.token,
    client_id: params.clientId,
  };
  if (params.tokenTypeHint) {
    formData.token_type_hint = params.tokenTypeHint;
  }
  const response = await request.post(`${AUTH_BASE}/oauth2/introspect`, { form: formData });
  return { response, data: await response.json() };
}

/**
 * Extract authorization code, state, and error from a redirect URL.
 */
export function extractCodeFromUrl(url: string) {
  const parsed = new URL(url);
  return {
    code: parsed.searchParams.get('code'),
    state: parsed.searchParams.get('state'),
    error: parsed.searchParams.get('error'),
    errorDescription: parsed.searchParams.get('error_description'),
  };
}

/**
 * Decode a JWT payload without verification (for test assertions only).
 */
export function decodeJwtPayload(jwt: string) {
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const payload = parts[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded);
}

/**
 * Redirect URI for test OAuth clients.
 * Points to a path on the app that doesn't exist —
 * we intercept the navigation before it loads.
 */
export const TEST_REDIRECT_URI = `${BASE_URL}/oauth/callback`;
