import { createAuthClient } from 'better-auth/client';

/**
 * Helper function to create and sign up a test user
 */
export async function createTestUser(email: string, name: string, password: string) {
  const authClient = createAuthClient({
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  });
  return authClient.signUp.email({
    email,
    password,
    name,
  });
}
