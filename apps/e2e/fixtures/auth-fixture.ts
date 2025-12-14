import { test as base, expect } from '@playwright/test';
import { createTestUser } from '../utils/auth-client';
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

    await createTestUser(testUser.email, testUser.name, testUser.password);

    const response = await page.request.post('http://localhost:3001/api/auth/sign-in/email', {
      data: {
        email: testUser.email,
        password: testUser.password,
      },
    });

    expect(response.ok()).toBeTruthy();

    await use(testUser);
  },
});

export { expect };
