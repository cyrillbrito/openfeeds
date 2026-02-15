import type { Page } from '@playwright/test';

export class SigninPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Locators
  getHeading() {
    return this.page.getByRole('heading', { name: 'Welcome Back' });
  }

  getEmailInput() {
    return this.page.getByPlaceholder('Enter your email');
  }

  getPasswordInput() {
    return this.page.getByPlaceholder('Enter your password');
  }

  getSignInButton() {
    return this.page.getByRole('button', { name: 'Sign In' });
  }

  getSignUpLink() {
    return this.page.getByRole('link', { name: 'Sign up' });
  }

  getForgotPasswordLink() {
    return this.page.getByRole('link', { name: 'Forgot password?' });
  }

  getErrorAlert() {
    return this.page.locator('.alert-error');
  }

  getLoadingButton() {
    return this.page.getByRole('button', { name: 'Signing In...' });
  }

  // Actions
  async goto() {
    await this.page.goto('/signin');
  }

  async fillEmail(email: string) {
    await this.getEmailInput().fill(email);
  }

  async fillPassword(password: string) {
    await this.getPasswordInput().fill(password);
  }

  async submitForm() {
    await this.getSignInButton().click();
  }

  async signinWithCredentials(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.submitForm();
  }

  async clickSignUpLink() {
    await this.getSignUpLink().click();
  }

  async clickForgotPasswordLink() {
    await this.getForgotPasswordLink().click();
  }

  async getErrorMessage() {
    const errorAlert = this.getErrorAlert();
    if (await errorAlert.isVisible()) {
      return await errorAlert.textContent();
    }
    return null;
  }

  async isLoading() {
    return await this.getLoadingButton().isVisible();
  }
}
