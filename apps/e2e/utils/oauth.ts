import { expect, type APIRequestContext, type Page } from '@playwright/test';

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
 *
 * The Streamable HTTP transport may respond with SSE (`text/event-stream`)
 * even when we prefer JSON. This helper returns both the raw response and,
 * when the response is SSE, the parsed JSON-RPC message(s) extracted from
 * the `event: message` / `data: …` lines.
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
 * Parse a JSON-RPC result from an MCP response that may be either plain JSON
 * or SSE (`text/event-stream`).  Returns the first `event: message` data
 * payload when SSE, or the full JSON body otherwise.
 */
export async function parseMcpResponse(response: Awaited<ReturnType<APIRequestContext['post']>>) {
  const contentType = response.headers()['content-type'] ?? '';
  if (contentType.includes('text/event-stream')) {
    const text = await response.text();
    // SSE format: "event: message\ndata: {…}\n\n"
    const messages: unknown[] = [];
    for (const block of text.split('\n\n')) {
      const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
      if (dataLine) {
        messages.push(JSON.parse(dataLine.slice('data: '.length)));
      }
    }
    // Return the first (and usually only) message for convenience.
    return messages[0] as Record<string, unknown>;
  }
  return (await response.json()) as Record<string, unknown>;
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
 * Fetch the OpenID Connect UserInfo endpoint with a Bearer token.
 */
export async function fetchUserInfo(request: APIRequestContext, accessToken: string) {
  const response = await request.get(`${AUTH_BASE}/oauth2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return { response, data: await response.json() };
}

/**
 * Redirect URI for test OAuth clients.
 * Points to a path on the app that doesn't exist —
 * we intercept the navigation before it loads.
 */
export const TEST_REDIRECT_URI = `${BASE_URL}/oauth/callback`;

/** Standard MCP initialize message for test assertions. */
export const MCP_INITIALIZE_MESSAGE = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'e2e-test', version: '1.0.0' },
  },
};

/**
 * Navigate to the authorize URL, grant consent, and return the authorization code.
 *
 * Intercepts the callback redirect so Playwright never loads the (non-existent)
 * callback page. Use this for any test that needs the standard "click Allow" flow.
 */
export async function consentAndGetCode(page: Page, authorizeUrl: string) {
  let callbackUrl: string | undefined;
  await page.route('**/oauth/callback**', async (route) => {
    callbackUrl = route.request().url();
    await route.fulfill({ status: 200, body: 'Callback intercepted' });
  });

  await page.goto(authorizeUrl);
  await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();
  await page.getByRole('button', { name: 'Allow' }).click();
  await page.waitForURL('**/oauth/callback**');

  const result = extractCodeFromUrl(callbackUrl ?? page.url());
  return result;
}

/**
 * Run the full OAuth flow (register → PKCE → authorize → consent → token exchange)
 * and return the resulting tokens + client ID.
 *
 * Covers the most common test preamble. Tests that need to deviate from the
 * happy path (wrong verifier, deny consent, missing resource, etc.) should
 * still inline the individual steps so the deviation is visible.
 */
export async function getTokensViaConsent(
  page: Page,
  request: APIRequestContext,
  options: {
    scope?: string;
    includeResource?: boolean;
    clientName?: string;
    clientUri?: string;
  } = {},
) {
  const {
    scope = 'openid profile email offline_access mcp:tools',
    includeResource = true,
    clientName,
    clientUri,
  } = options;

  const { data: client } = await registerPublicClient(request, {
    redirectUri: TEST_REDIRECT_URI,
    clientName,
    clientUri,
  });
  const { codeVerifier, codeChallenge } = await generatePKCE();
  const state = generateState();
  const mcpResource = includeResource ? await getMcpResource(request) : undefined;

  const authorizeUrl = buildAuthorizeUrl({
    clientId: client.client_id,
    redirectUri: TEST_REDIRECT_URI,
    scope,
    codeChallenge,
    state,
    resource: mcpResource,
  });

  const { code } = await consentAndGetCode(page, authorizeUrl);
  expect(code).toBeDefined();

  const { data: tokens } = await exchangeCodeForTokens(request, {
    code: code!,
    clientId: client.client_id,
    redirectUri: TEST_REDIRECT_URI,
    codeVerifier,
    resource: mcpResource,
  });

  return { tokens, clientId: client.client_id };
}
