import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import {
  buildAuthorizeUrl,
  decodeJwtPayload,
  exchangeCodeForTokens,
  extractCodeFromUrl,
  generatePKCE,
  generateState,
  getMcpResource,
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

    // 4. Navigate to the authorize URL.
    //    The user is already authenticated (via auth fixture),
    //    so it should skip login and go to consent.
    //    Intercept the callback redirect to capture the code.
    let callbackUrl: string | undefined;
    await page.route('**/oauth/callback**', async (route) => {
      callbackUrl = route.request().url();
      await route.fulfill({ status: 200, body: 'Callback intercepted' });
    });

    await page.goto(authorizeUrl);

    // 5. We should land on the consent page
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();
    await expect(page.getByText('E2E Flow Test')).toBeVisible();

    // 6. Click "Allow" to grant consent
    await page.getByRole('button', { name: 'Allow' }).click();

    // 7. Wait for the redirect to our callback
    await page.waitForURL('**/oauth/callback**');
    const currentUrl = callbackUrl ?? page.url();

    // 8. Extract the authorization code
    const { code, state: returnedState, error } = extractCodeFromUrl(currentUrl);
    expect(error).toBeNull();
    expect(returnedState).toBe(state);
    expect(code).toBeDefined();

    // 9. Exchange the code for tokens
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

    // 10. Verify the JWT payload
    const payload = decodeJwtPayload(tokens.access_token);
    expect(payload.sub).toBeDefined();
    expect(payload.scope).toContain('mcp:tools');

    // 11. Verify the access token works against the MCP endpoint
    const { response: mcpResponse } = await sendMcpMessage(request, tokens.access_token, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'e2e-test', version: '1.0.0' },
      },
    });
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
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();
    const mcpResource = await getMcpResource(request);

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid offline_access mcp:tools',
      codeChallenge,
      state,
      resource: mcpResource,
    });

    let callbackUrl: string | undefined;
    await page.route('**/oauth/callback**', async (route) => {
      callbackUrl = route.request().url();
      await route.fulfill({ status: 200, body: 'Callback intercepted' });
    });

    await page.goto(authorizeUrl);

    // Consent
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();
    await page.getByRole('button', { name: 'Allow' }).click();
    await page.waitForURL('**/oauth/callback**');

    const { code } = extractCodeFromUrl(callbackUrl ?? page.url());
    expect(code).toBeDefined();

    // Exchange code for tokens
    const { data: tokens } = await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier,
      resource: mcpResource,
    });

    expect(tokens.access_token).toBeDefined();
    expect(tokens.refresh_token).toBeDefined();
  });
});
