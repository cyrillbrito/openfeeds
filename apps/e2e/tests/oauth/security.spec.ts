import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import {
  BASE_URL,
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  extractCodeFromUrl,
  generatePKCE,
  generateState,
  getMcpResource,
  registerPublicClient,
  TEST_REDIRECT_URI,
} from '../../utils/oauth';

test.describe('OAuth Security', () => {
  test.setTimeout(30_000);

  test('authorization code cannot be reused (single-use)', async ({ page, request, user }) => {
    // Complete the full OAuth flow to get a valid authorization code
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
    expect(code).toBeDefined();

    // First exchange — should succeed
    const { response: firstResponse } = await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier,
      resource: mcpResource,
    });
    expect(firstResponse.ok()).toBeTruthy();

    // Second exchange with the same code — must fail
    const { response: replayResponse } = await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier,
      resource: mcpResource,
    });
    expect(replayResponse.ok()).toBeFalsy();
  });

  test('wrong PKCE code_verifier is rejected', async ({ page, request, user }) => {
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeChallenge } = await generatePKCE();
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
    expect(code).toBeDefined();

    // Send a wrong code_verifier — server must reject
    const { response } = await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier: 'deliberately-wrong-verifier-that-does-not-match-the-challenge',
      resource: mcpResource,
    });
    expect(response.ok()).toBeFalsy();
  });

  test('unknown client_id at authorize returns an error', async ({ page, request, user }) => {
    const { codeChallenge } = await generatePKCE();
    const state = generateState();

    const authorizeUrl = buildAuthorizeUrl({
      clientId: 'non-existent-client-id-12345',
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile mcp:tools',
      codeChallenge,
      state,
    });

    // Navigate to authorize with a fake client_id
    const response = await request.get(authorizeUrl, { maxRedirects: 0 });

    // The server should not redirect to a callback — it should return an error.
    // Accept either a 4xx error page or a redirect with an error param.
    const status = response.status();
    if (status >= 300 && status < 400) {
      // If it redirected, the error must be in the redirect URL
      const location = response.headers()['location'] ?? '';
      expect(location).toMatch(/error=/);
    } else {
      // Direct error response
      expect(status).toBeGreaterThanOrEqual(400);
    }
  });
});
