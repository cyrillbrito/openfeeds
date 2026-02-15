import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import {
  buildAuthorizeUrl,
  consentAndGetCode,
  exchangeCodeForTokens,
  extractCodeFromUrl,
  generatePKCE,
  generateState,
  getMcpResource,
  registerPublicClient,
  TEST_REDIRECT_URI,
} from '../../utils/oauth';

test.describe('Consent Page', () => {
  test.setTimeout(30_000);

  test('displays client info and requested scopes', async ({ page, request, user }) => {
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
      clientName: 'Consent Test App',
      clientUri: 'https://consent-test.example.com',
    });

    const { codeChallenge } = await generatePKCE();
    const state = generateState();

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile email mcp:tools',
      codeChallenge,
      state,
    });

    await page.goto(authorizeUrl);

    // Verify the consent page displays correctly
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();
    await expect(page.getByText('Consent Test App')).toBeVisible();
    await expect(page.getByText('https://consent-test.example.com')).toBeVisible();

    // Verify scope descriptions are shown
    await expect(page.getByText('Verify your identity')).toBeVisible();
    await expect(page.getByText('View your name and profile picture')).toBeVisible();
    await expect(page.getByText('View your email address')).toBeVisible();
    await expect(page.getByText('Use tools on your behalf')).toBeVisible();

    // Verify action buttons are present
    await expect(page.getByRole('button', { name: 'Allow' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Deny' })).toBeVisible();
  });

  test('denying consent redirects with error', async ({ page, request, user }) => {
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeChallenge } = await generatePKCE();
    const state = generateState();

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid mcp:tools',
      codeChallenge,
      state,
    });

    let callbackUrl: string | undefined;
    await page.route('**/oauth/callback**', async (route) => {
      callbackUrl = route.request().url();
      await route.fulfill({ status: 200, body: 'Callback intercepted' });
    });

    await page.goto(authorizeUrl);
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();

    // Deny the consent
    await page.getByRole('button', { name: 'Deny' }).click();

    // Should redirect to callback with an error
    await page.waitForURL('**/oauth/callback**');
    const { error } = extractCodeFromUrl(callbackUrl ?? page.url());
    expect(error).toBe('access_denied');
  });

  test('previously consented client skips consent on re-authorization', async ({
    page,
    request,
    user,
  }) => {
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });
    const { codeVerifier, codeChallenge } = await generatePKCE();
    const state = generateState();
    const mcpResource = await getMcpResource(request);

    // First authorization — grant consent
    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile mcp:tools',
      codeChallenge,
      state,
      resource: mcpResource,
    });

    const { code } = await consentAndGetCode(page, authorizeUrl);
    expect(code).toBeDefined();

    // Exchange the code to complete the flow
    await exchangeCodeForTokens(request, {
      code: code!,
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      codeVerifier,
    });

    // Second authorization — same scopes, should skip consent
    const { codeChallenge: codeChallenge2 } = await generatePKCE();
    const state2 = generateState();

    const authorizeUrl2 = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile mcp:tools',
      codeChallenge: codeChallenge2,
      state: state2,
      resource: mcpResource,
    });

    // The route intercept is still active from consentAndGetCode,
    // so we just navigate and expect a direct redirect (no consent page).
    await page.goto(authorizeUrl2);
    await page.waitForURL('**/oauth/callback**');
    const result = extractCodeFromUrl(page.url());
    expect(result.error).toBeNull();
    expect(result.code).toBeDefined();
  });

  test('consent page visual regression', async ({ page, request, user }) => {
    const { data: client } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
      clientName: 'Visual Test App',
      clientUri: 'https://visual-test.example.com',
    });
    const { codeChallenge } = await generatePKCE();
    const state = generateState();

    const authorizeUrl = buildAuthorizeUrl({
      clientId: client.client_id,
      redirectUri: TEST_REDIRECT_URI,
      scope: 'openid profile email offline_access mcp:tools',
      codeChallenge,
      state,
    });

    await page.goto(authorizeUrl);
    await expect(page.getByRole('heading', { name: 'Authorize Application' })).toBeVisible();
    await expect(page.getByText('Visual Test App')).toBeVisible();

    await expect(page).toHaveScreenshot();
  });
});
