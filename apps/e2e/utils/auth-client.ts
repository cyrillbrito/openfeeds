import { createAuthClient } from 'better-auth/client';

/**
 * Better Auth client for E2E tests
 * Uses the official Better Auth client to interact with auth endpoints
 */
export function createTestAuthClient(baseUrl = process.env.BASE_URL ?? 'http://localhost:3000') {
  return createAuthClient({
    baseURL: baseUrl,
  });
}

/**
 * Helper function to create and sign up a test user
 */
export async function createTestUser(email: string, name: string, password: string) {
  const authClient = createTestAuthClient();
  return authClient.signUp.email({
    email,
    password,
    name,
  });
}

/**
 * Helper function to sign in a test user
 */
export async function signInTestUser(email: string, password: string) {
  const authClient = createTestAuthClient();
  return authClient.signIn.email({
    email,
    password,
  });
}
