import { Page } from '@playwright/test';

export class SignupPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Locators
  getHeading() {
    return this.page.getByRole('heading', { name: 'Join OpenFeeds' });
  }

  getNameInput() {
    return this.page.getByPlaceholder('Enter your full name');
  }

  getEmailInput() {
    return this.page.getByPlaceholder('Enter your email');
  }

  getPasswordInput() {
    return this.page.getByPlaceholder('Create a password');
  }

  getConfirmPasswordInput() {
    return this.page.getByPlaceholder('Confirm your password');
  }

  getCreateAccountButton() {
    return this.page.getByRole('button', { name: 'Create Account' });
  }

  getSignInLink() {
    return this.page.getByRole('link', { name: 'Sign in' });
  }

  getErrorAlert() {
    return this.page.locator('.alert-error');
  }

  getLoadingButton() {
    return this.page.getByRole('button', { name: 'Creating Account...' });
  }

  // Actions
  async goto() {
    await this.page.goto('/signup');
  }

  async fillName(name: string) {
    await this.getNameInput().fill(name);
  }

  async fillEmail(email: string) {
    await this.getEmailInput().fill(email);
  }

  async fillPassword(password: string) {
    await this.getPasswordInput().fill(password);
  }

  async fillConfirmPassword(password: string) {
    await this.getConfirmPasswordInput().fill(password);
  }

  async submitForm() {
    await this.getCreateAccountButton().click();
  }

  async signupWithCredentials(
    name: string,
    email: string,
    password: string,
    confirmPassword?: string,
  ) {
    await this.fillName(name);
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.fillConfirmPassword(confirmPassword || password);
    await this.submitForm();
  }

  async clickSignInLink() {
    await this.getSignInLink().click();
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
