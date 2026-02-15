import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  extractCodeFromUrl,
  generatePKCE,
  generateState,
  getMcpResource,
  introspectToken,
  refreshAccessToken,
  registerPublicClient,
  revokeToken,
  TEST_REDIRECT_URI,
} from '../../utils/oauth';

test.describe('Token Lifecycle', () => {
  test.setTimeout(30_000);

  /**
   * Helper: run the full OAuth flow and return tokens + client info.
   * Reused by multiple tests in this file.
   */
  async function getTokens(
    page: Parameters<Parameters<typeof test>[2]>[0]['page'],
    request: Parameters<Parameters<typeof test>[2]>[0]['request'],
    scope = 'openid profile offline_access mcp:tools',
  ) {
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();
    const mcpResource = await getMcpResource(request);

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope,
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

    return { tokens, clientId: client.client_id };
  }

  test('refresh token grants a new access token', async ({ page, request, user }) => {
    const { tokens, clientId } = await getTokens(page, request);
    expect(tokens.refresh_token).toBeDefined();

    // Use the refresh token to get a new access token
    const { response, data: refreshed } = await refreshAccessToken(request, {
      refreshToken: tokens.refresh_token,
      clientId,
    });

    expect(response.ok()).toBeTruthy();
    expect(refreshed.access_token).toBeDefined();
    // The new access token should be different from the original
    expect(refreshed.access_token).not.toBe(tokens.access_token);
  });

  // Skipped: introspection endpoint requires client_secret (RFC 7662 §2.1), but MCP
  // clients are public (token_endpoint_auth_method: "none") and have no secret.
  test.skip('token introspection returns active status', async ({ page, request, user }) => {
    const { tokens, clientId } = await getTokens(page, request);

    const { response, data } = await introspectToken(request, {
      token: tokens.access_token,
      clientId,
      tokenTypeHint: 'access_token',
    });

    expect(response.ok()).toBeTruthy();
    expect(data.active).toBe(true);
    expect(data.sub).toBeDefined();
  });

  // Skipped: same reason — public clients cannot call the introspection endpoint.
  test.skip('introspection returns inactive for revoked token', async ({ page, request, user }) => {
    const { tokens, clientId } = await getTokens(page, request);

    // Revoke the refresh token (which also invalidates associated access tokens)
    const { response: revokeResponse } = await revokeToken(request, {
      token: tokens.refresh_token,
      clientId,
      tokenTypeHint: 'refresh_token',
    });
    expect(revokeResponse.ok()).toBeTruthy();

    // Introspect the refresh token — should be inactive
    const { data } = await introspectToken(request, {
      token: tokens.refresh_token,
      clientId,
      tokenTypeHint: 'refresh_token',
    });

    expect(data.active).toBe(false);
  });

  test('revoked refresh token prevents new access tokens', async ({ page, request, user }) => {
    const { tokens, clientId } = await getTokens(page, request);
    expect(tokens.refresh_token).toBeDefined();

    // Revoke the refresh token
    const { response: revokeResponse } = await revokeToken(request, {
      token: tokens.refresh_token,
      clientId,
      tokenTypeHint: 'refresh_token',
    });
    expect(revokeResponse.ok()).toBeTruthy();

    // Try to use the revoked refresh token — should fail
    const { response: refreshResponse } = await refreshAccessToken(request, {
      refreshToken: tokens.refresh_token,
      clientId,
    });

    expect(refreshResponse.ok()).toBeFalsy();
  });
});
