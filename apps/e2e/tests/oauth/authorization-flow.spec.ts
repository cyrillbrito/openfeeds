import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import {
  buildAuthorizeUrl,
  consentAndGetCode,
  decodeJwtPayload,
  exchangeCodeForTokens,
  generatePKCE,
  generateState,
  getMcpResource,
  getTokensViaConsent,
  MCP_INITIALIZE_MESSAGE,
  registerPublicClient,
  sendMcpMessage,
  TEST_REDIRECT_URI,
} from '../../utils/oauth';

test.describe('OAuth Authorization Flow', () => {
  // These tests involve multiple redirects and network round trips
  test.setTimeout(30_000);

  test('complete flow: register → authorize → consent → token → MCP tool call', async ({
    page,
    request,
    user,
  }) => {
    // 1. Register a public OAuth client
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
      clientName: 'E2E Flow Test',
    });
    expect(client.client_id).toBeDefined();

    // 2. Generate PKCE and state
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();
    const mcpResource = await getMcpResource(request);

    // 3. Build the authorize URL
    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile email mcp:tools',
      codeChallenge,
      state,
      resource: mcpResource,
    });

    // 4. Navigate to authorize, consent, and capture the code
    const { code, state: returnedState, error } = await consentAndGetCode(page, authorizeUrl);
    expect(error).toBeNull();
    expect(returnedState).toBe(state);
    expect(code).toBeDefined();

    // 5. Exchange the code for tokens
    const { response: tokenResponse, data: tokens } = await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier,
      resource: mcpResource,
    });
    expect(tokenResponse.ok()).toBeTruthy();
    expect(tokens.access_token).toBeDefined();
    expect(tokens.token_type.toLowerCase()).toBe('bearer');

    // 6. Verify the JWT payload
    const payload = decodeJwtPayload(tokens.access_token);
    expect(payload.sub).toBeDefined();
    expect(payload.scope).toContain('mcp:tools');

    // 7. Verify the access token works against the MCP endpoint
    const { response: mcpResponse } = await sendMcpMessage(
      request,
      tokens.access_token,
      MCP_INITIALIZE_MESSAGE,
    );
    expect(mcpResponse.ok()).toBeTruthy();
  });

  test('already-authenticated user skips login page', async ({ page, request, user }) => {
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeChallenge } = await generatePKCE();
    const state = generateState();

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile mcp:tools',
      codeChallenge,
      state,
    });

    await page.goto(authorizeUrl);

    // Since the user is already authenticated (via fixture), we should NOT see the signin page.
    // We should land on the consent page directly.
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();

    // Verify we are NOT on the signin page
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).not.toBeVisible();
  });

  test('flow with offline_access scope returns refresh token', async ({ page, request, user }) => {
    const { tokens } = await getTokensViaConsent(page, request, {
      scope: 'openid offline_access mcp:tools',
    });

    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeDefined();
  });
});
