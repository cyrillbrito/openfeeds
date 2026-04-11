import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth-fixture';
import { fetchUserInfo, getTokensViaConsent } from '../../utils/oauth';

test.describe('UserInfo Endpoint', () => {
  test.setTimeout(30_000);

  test('returns user claims with openid profile email scopes', async ({ page, request, user }) => {
    const { tokens } = await getTokensViaConsent(page, request, {
      scope: 'openid profile email mcp:tools',
    });

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
