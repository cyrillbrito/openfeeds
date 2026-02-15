import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import {
  buildAuthorizeUrl,
  exchangeCodeForTokens,
  extractCodeFromUrl,
  fetchUserInfo,
  generatePKCE,
  generateState,
  getMcpResource,
  registerPublicClient,
  TEST_REDIRECT_URI,
} from '../../utils/oauth';

test.describe('UserInfo Endpoint', () => {
  test.setTimeout(30_000);

  /**
   * Helper: run the full OAuth flow and return tokens + client info.
   */
  async function getTokens(
    page: Parameters<Parameters<typeof test>[2]>[0]['page'],
    request: Parameters<Parameters<typeof test>[2]>[0]['request'],
    scope = 'openid profile email mcp:tools',
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

  test('returns user claims with openid profile email scopes', async ({ page, request, user }) => {
    const { tokens } = await getTokens(page, request, 'openid profile email mcp:tools');

    const { response, data } = await fetchUserInfo(request, tokens.access_token);

    expect(response.ok()).toBeTruthy();
    // sub is required by OIDC spec
    expect(data.sub).toBeDefined();
    // profile scope should include name
    expect(data.name).toBe(user.name);
    // email scope should include email
    expect(data.email).toBe(user.email);
  });

  test('rejects requests without a token', async ({ request }) => {
    const { response } = await fetchUserInfo(request, '');

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
