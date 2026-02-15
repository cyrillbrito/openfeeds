import { expect, test } from '@playwright/test';
import { BASE_URL } from '../../utils/oauth';

test.describe('Well-Known Discovery Endpoints', () => {
  test('returns valid OpenID Configuration', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/.well-known/openid-configuration`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.issuer).toBeDefined();
    expect(data.authorization_endpoint).toContain('/oauth2/authorize');
    expect(data.token_endpoint).toContain('/oauth2/token');
    expect(data.jwks_uri).toContain('/jwks');
    expect(data.response_types_supported).toContain('code');
    expect(data.scopes_supported).toEqual(
      expect.arrayContaining(['openid', 'profile', 'email', 'offline_access', 'mcp:tools']),
    );
    expect(data.userinfo_endpoint).toContain('/oauth2/userinfo');
  });

  test('returns valid OAuth Authorization Server metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/.well-known/oauth-authorization-server`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.issuer).toBeDefined();
    expect(data.authorization_endpoint).toContain('/oauth2/authorize');
    expect(data.token_endpoint).toContain('/oauth2/token');
    expect(data.registration_endpoint).toContain('/oauth2/register');
    expect(data.response_types_supported).toContain('code');
    expect(data.grant_types_supported).toEqual(
      expect.arrayContaining(['authorization_code', 'refresh_token']),
    );
    expect(data.code_challenge_methods_supported).toContain('S256');
  });

  test('returns OAuth AS metadata at issuer-scoped path', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/.well-known/oauth-authorization-server/api/auth`,
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // Should contain the same metadata as the root path
    expect(data.issuer).toBeDefined();
    expect(data.authorization_endpoint).toContain('/oauth2/authorize');
    expect(data.token_endpoint).toContain('/oauth2/token');
  });

  test('returns Protected Resource metadata', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/.well-known/oauth-protected-resource`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.resource).toContain('/api/mcp');
    expect(data.authorization_servers).toBeDefined();
    expect(data.authorization_servers.length).toBeGreaterThan(0);
    expect(data.authorization_servers[0]).toContain('/api/auth');
  });

  test('JWKS endpoint returns valid keys', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/auth/jwks`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.keys).toBeDefined();
    expect(Array.isArray(data.keys)).toBe(true);
    expect(data.keys.length).toBeGreaterThan(0);

    const key = data.keys[0];
    expect(key.kty).toBeDefined();
    expect(key.kid).toBeDefined();
  });
});
