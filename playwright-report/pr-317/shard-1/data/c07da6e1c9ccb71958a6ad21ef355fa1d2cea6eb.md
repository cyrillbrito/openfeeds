# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ai-chat/messaging.spec.ts >> AI Chat Messaging >> multiple messages in sequence
- Location: tests/ai-chat/messaging.spec.ts:43:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3400/
Call log:
  - navigating to "http://localhost:3400/", waiting until "load"

```

# Test source

```ts
  1  | import { test as base, expect } from '@playwright/test';
  2  | import { generateTestEmail, generateTestPassword } from '../utils/creds';
  3  | 
  4  | interface TestUser {
  5  |   name: string;
  6  |   email: string;
  7  |   password: string;
  8  | }
  9  | 
  10 | interface AuthFixtures {
  11 |   user: TestUser;
  12 | }
  13 | 
  14 | export const test = base.extend<AuthFixtures>({
  15 |   user: async ({ page }, use) => {
  16 |     const testUser: TestUser = {
  17 |       name: 'Test User',
  18 |       email: generateTestEmail(),
  19 |       password: generateTestPassword(),
  20 |     };
  21 | 
  22 |     // Navigate first so page.evaluate runs in the app's origin context.
  23 |     // Both sign-up and sign-in run inside the browser (not Node.js) to avoid
  24 |     // Node undici incompatibilities and ensure cookies are set correctly.
> 25 |     await page.goto('/');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3400/
  26 | 
  27 |     const authResult = await page.evaluate(async ({ name, email, password }) => {
  28 |       const signUp = await fetch('/api/auth/sign-up/email', {
  29 |         method: 'POST',
  30 |         headers: { 'Content-Type': 'application/json' },
  31 |         credentials: 'include',
  32 |         body: JSON.stringify({ name, email, password }),
  33 |       });
  34 |       if (!signUp.ok) {
  35 |         return { ok: false, step: 'sign-up', status: signUp.status, body: await signUp.text() };
  36 |       }
  37 | 
  38 |       const signIn = await fetch('/api/auth/sign-in/email', {
  39 |         method: 'POST',
  40 |         headers: { 'Content-Type': 'application/json' },
  41 |         credentials: 'include',
  42 |         body: JSON.stringify({ email, password }),
  43 |       });
  44 |       if (!signIn.ok) {
  45 |         return { ok: false, step: 'sign-in', status: signIn.status, body: await signIn.text() };
  46 |       }
  47 | 
  48 |       return { ok: true, step: 'done', status: signIn.status, body: '' };
  49 |     }, testUser);
  50 | 
  51 |     expect(
  52 |       authResult,
  53 |       `Auth fixture ${authResult.step} failed: ${authResult.status} ${authResult.body}`,
  54 |     ).toHaveProperty('ok', true);
  55 | 
  56 |     await use(testUser);
  57 |   },
  58 | });
  59 | 
  60 | export { expect };
  61 | 
```