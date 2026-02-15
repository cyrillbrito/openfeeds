import { expect, test } from '@playwright/test';
import { BASE_URL, registerPublicClient, TEST_REDIRECT_URI } from '../../utils/oauth';

test.describe('Dynamic Client Registration', () => {
  test('registers a public client without authentication', async ({ request }) => {
    const { response, data } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
    });

    expect(response.ok()).toBeTruthy();
    expect(data.client_id).toBeDefined();
    expect(typeof data.client_id).toBe('string');
    // Public clients should not receive a client_secret
    expect(data.client_secret).toBeFalsy();
    expect(data.redirect_uris).toContain(TEST_REDIRECT_URI);
    expect(data.token_endpoint_auth_method).toBe('none');
  });

  test('registers a client with custom metadata', async ({ request }) => {
    const { response, data } = await registerPublicClient(request, {
      redirectUri: TEST_REDIRECT_URI,
      clientName: 'My Custom App',
      clientUri: 'https://example.com',
    });

    expect(response.ok()).toBeTruthy();
    expect(data.client_id).toBeDefined();
    expect(data.client_name).toBe('My Custom App');
    expect(data.client_uri).toBe('https://example.com');
  });

  test('rejects registration with missing redirect_uris', async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/auth/oauth2/register`, {
      data: {
        token_endpoint_auth_method: 'none',
        client_name: 'Bad Client',
      },
    });

    // Should fail — redirect_uris is required
    expect(response.ok()).toBeFalsy();
  });
});
