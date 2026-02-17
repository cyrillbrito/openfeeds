import { expect, test } from '@playwright/test';
import { SignupPage } from '../lib/SignupPage';
import { createTestUser } from '../utils/auth-client';
import { generateTestEmail, generateTestPassword } from '../utils/creds';
import { addNetworkDelay, simulateNetworkFailure } from '../utils/network';

let signupPage: SignupPage;

test.beforeEach(async ({ page }) => {
  signupPage = new SignupPage(page);
  await signupPage.goto();
});

test('display signup page elements', async ({ page }) => {
  await expect(signupPage.getHeading()).toBeVisible();
  await expect(signupPage.getNameInput()).toBeVisible();
  await expect(signupPage.getEmailInput()).toBeVisible();
  await expect(signupPage.getPasswordInput()).toBeVisible();
  await expect(signupPage.getConfirmPasswordInput()).toBeVisible();
  await expect(signupPage.getCreateAccountButton()).toBeVisible();
  await expect(signupPage.getSignInLink()).toBeVisible();

  await expect(page).toHaveScreenshot();
});

test('show error when passwords do not match', async ({ page }) => {
  const testUser = {
    name: 'Test User',
    email: generateTestEmail(),
    password: generateTestPassword(),
  };

  await signupPage.fillName(testUser.name);
  await signupPage.fillEmail(testUser.email);
  await signupPage.fillPassword(testUser.password);
  await signupPage.fillConfirmPassword('differentpassword');
  await signupPage.submitForm();

  await expect(signupPage.getErrorAlert()).toBeVisible();
  const errorMessage = await signupPage.getErrorMessage();
  expect(errorMessage).toContain('Passwords do not match');

  await expect(page).toHaveScreenshot({
    mask: [
      signupPage.getNameInput(),
      signupPage.getEmailInput(),
      signupPage.getPasswordInput(),
      signupPage.getConfirmPasswordInput(),
    ],
  });
});

test('validate required fields', async ({ page }) => {
  await signupPage.submitForm();

  // Check that form validation prevents submission
  // Browser's native validation should kick in for required fields
  await expect(signupPage.getNameInput()).toBeFocused();

  await expect(page).toHaveScreenshot();
});

test('validate email format', async ({ page }) => {
  const testUser = {
    name: 'Test User',
    password: generateTestPassword(),
  };

  await signupPage.fillName(testUser.name);
  await signupPage.fillEmail('invalid-email');
  await signupPage.fillPassword(testUser.password);
  await signupPage.fillConfirmPassword(testUser.password);
  await signupPage.submitForm();

  // Browser's native email validation should prevent submission
  await expect(signupPage.getEmailInput()).toBeFocused();

  await expect(page).toHaveScreenshot({
    mask: [
      signupPage.getNameInput(),
      signupPage.getEmailInput(),
      signupPage.getPasswordInput(),
      signupPage.getConfirmPasswordInput(),
    ],
  });
});

test('disable form during submission', async ({ page }) => {
  const testUser = {
    name: 'Test User',
    email: generateTestEmail(),
    password: generateTestPassword(),
  };

  await signupPage.fillName(testUser.name);
  await signupPage.fillEmail(testUser.email);
  await signupPage.fillPassword(testUser.password);
  await signupPage.fillConfirmPassword(testUser.password);

  // Add network delay to test loading state
  await addNetworkDelay(signupPage.page, '**/api/auth/**');

  await signupPage.submitForm();

  // Check loading state
  await expect(signupPage.getLoadingButton()).toBeVisible();
  await expect(signupPage.getNameInput()).toBeDisabled();
  await expect(signupPage.getEmailInput()).toBeDisabled();
  await expect(signupPage.getPasswordInput()).toBeDisabled();
  await expect(signupPage.getConfirmPasswordInput()).toBeDisabled();

  await expect(page).toHaveScreenshot({
    mask: [
      signupPage.getNameInput(),
      signupPage.getEmailInput(),
      signupPage.getPasswordInput(),
      signupPage.getConfirmPasswordInput(),
    ],
  });
});

test('navigate to signin page when clicking sign in link', async ({ page }) => {
  await signupPage.clickSignInLink();
  await expect(page).toHaveURL('/login');
});

test('handle successful signup and redirect', async ({ page }) => {
  const testUser = {
    name: 'Test User',
    email: generateTestEmail(),
    password: generateTestPassword(),
  };

  await signupPage.signupWithCredentials(testUser.name, testUser.email, testUser.password);

  // Should redirect to inbox page after successful signup
  await expect(page).toHaveURL('/feeds');

  // Test that user remains logged in when navigating back to signup
  await signupPage.goto();
  await expect(page).toHaveURL('/feeds');

  // TODO Should clean up, use the SDK to delete the user
  // This endpoint does not exist yet. To be done later
});

test('handle signup errors from server', async ({ page }) => {
  const testUser = {
    name: 'Test User',
    email: generateTestEmail(),
    password: generateTestPassword(),
  };

  await createTestUser(testUser.email, testUser.name, testUser.password);

  await signupPage.signupWithCredentials(testUser.name, testUser.email, testUser.password);

  await expect(signupPage.getErrorAlert()).toBeVisible();
  const errorMessage = await signupPage.getErrorMessage();
  expect(errorMessage).toContain('already exists');

  await expect(page).toHaveScreenshot('signup-user-already-exists-error.png', {
    mask: [signupPage.getNameInput(), signupPage.getEmailInput()],
  });

  // TODO Should clean up, use the SDK to delete the user
  // This endpoint does not exist yet. To be done later
});

test('handle signup with redirect parameter', async ({ page }) => {
  const testUser = {
    name: 'Test User',
    email: generateTestEmail(),
    password: generateTestPassword(),
  };

  // Navigate with redirect parameter
  await page.goto('/signup?redirect=/feeds');

  await signupPage.signupWithCredentials(testUser.name, testUser.email, testUser.password);

  // Should redirect to the specified redirect URL
  await expect(page).toHaveURL('/feeds');

  // TODO Should clean up, use the SDK to delete the user
  // This endpoint does not exist yet. To be done later
});

test('handle network errors gracefully', async ({ page }) => {
  const testUser = {
    name: 'Test User',
    email: generateTestEmail(),
    password: generateTestPassword(),
  };

  // Simulate network failure
  await simulateNetworkFailure(signupPage.page, '**/api/auth/sign-up/**');

  await signupPage.signupWithCredentials(testUser.name, testUser.email, testUser.password);

  await expect(signupPage.getErrorAlert()).toBeVisible();
  const errorMessage = await signupPage.getErrorMessage();
  expect(errorMessage).toContain('Unexpected network error');

  await expect(page).toHaveScreenshot({
    mask: [
      signupPage.getNameInput(),
      signupPage.getEmailInput(),
      signupPage.getPasswordInput(),
      signupPage.getConfirmPasswordInput(),
    ],
  });
});
