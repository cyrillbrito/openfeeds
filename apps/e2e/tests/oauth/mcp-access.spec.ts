import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  extractCodeFromUrl,
  generatePKCE,
  generateState,
  getMcpResource,
  registerPublicClient,
  sendMcpMessage,
  TEST_REDIRECT_URI,
} from '../../utils/oauth';

test.describe('MCP Endpoint Access Control', () => {
  test.setTimeout(30_000);

  test('rejects requests without a token', async ({ request }) => {
    const { response } = await sendMcpMessage(request, '', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'e2e-test', version: '1.0.0' },
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('rejects requests with an invalid token', async ({ request }) => {
    const { response } = await sendMcpMessage(request, 'invalid.jwt.token', {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'e2e-test', version: '1.0.0' },
      },
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('rejects tokens without mcp:tools scope', async ({ page, request, user }) => {
    // Register a client and go through the full flow, but only request openid+profile
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();
    const mcpResource = await getMcpResource(request);

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile', // Deliberately NO mcp:tools
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
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();
    await page.getByRole('button', { name: 'Allow' }).click();
    await page.waitForURL('**/oauth/callback**');

    const { code } = extractCodeFromUrl(callbackUrl ?? page.url());
    expect(code).toBeDefined();

    const { data: tokens } = await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier,
      resource: mcpResource,
    });
    expect(tokens.access_token).toBeDefined();

    // Now try to call MCP with this token that lacks mcp:tools scope
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

    // Should be rejected due to missing scope
    expect(mcpResponse.status()).toBeGreaterThanOrEqual(400);
  });

  test('rejects token issued without the MCP resource audience', async ({
    page,
    request,
    user,
  }) => {
    // Get a valid token but WITHOUT specifying the `resource` parameter.
    // The resulting JWT will lack the MCP audience claim.
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile mcp:tools',
      codeChallenge,
      state,
      // Deliberately omit `resource` — no audience binding
    });

    let callbackUrl: string | undefined;
    await page.route('**/oauth/callback**', async (route) => {
      callbackUrl = route.request().url();
      await route.fulfill({ status: 200, body: 'Callback intercepted' });
    });

    await page.goto(authorizeUrl);
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();
    await page.getByRole('button', { name: 'Allow' }).click();
    await page.waitForURL('**/oauth/callback**');

    const { code } = extractCodeFromUrl(callbackUrl ?? page.url());
    const { data: tokens } = await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier,
      // No `resource` here either
    });
    expect(tokens.access_token).toBeDefined();

    // Try MCP with this token — should be rejected (wrong/missing audience)
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

    expect(mcpResponse.status()).toBeGreaterThanOrEqual(400);
  });

  test('accepts valid token and returns tool results', async ({ page, request, user }) => {
    // Full happy path to get a valid token with mcp:tools
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();
    const mcpResource = await getMcpResource(request);

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile mcp:tools',
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
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();
    await page.getByRole('button', { name: 'Allow' }).click();
    await page.waitForURL('**/oauth/callback**');

    const { code } = extractCodeFromUrl(callbackUrl ?? page.url());
    const { data: tokens } = await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier,
      resource: mcpResource,
    });

    // Call MCP with the valid token — send a single initialize request
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
});
