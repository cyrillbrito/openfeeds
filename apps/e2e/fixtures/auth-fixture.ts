import { test as base, expect } from '@playwright/test';
import { generateTestEmail, generateTestPassword } from '../utils/creds';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export interface AuthFixtures {
  user: TestUser;
}

export const test = base.extend<AuthFixtures>({
  user: async ({ page }, use) => {
    const testUser: TestUser = {
      name: 'Test User',
      email: generateTestEmail(),
      password: generateTestPassword(),
    };

    // Navigate first so page.evaluate runs in the app's origin context.
    // Both sign-up and sign-in run inside the browser (not Node.js) to avoid
    // Node undici incompatibilities and ensure cookies are set correctly.
    await page.goto('/');

    const authResult = await page.evaluate(async ({ name, email, password }) => {
      const signUp = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name, email, password }),
      });
      if (!signUp.ok) {
        return { ok: false, step: 'sign-up', status: signUp.status, body: await signUp.text() };
      }

      const signIn = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!signIn.ok) {
        return { ok: false, step: 'sign-in', status: signIn.status, body: await signIn.text() };
      }

      return { ok: true, step: 'done', status: signIn.status, body: '' };
    }, testUser);

    expect(
      authResult,
      `Auth fixture ${authResult.step} failed: ${authResult.status} ${authResult.body}`,
    ).toHaveProperty('ok', true);

    await use(testUser);
  },
});

export { expect };
