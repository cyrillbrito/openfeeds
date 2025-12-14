import { Page } from '@playwright/test';

export class DeleteFeedModal {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  getModal() {
    return this.page.locator('dialog').filter({ hasText: 'Delete Feed' });
  }

  getConfirmButton() {
    return this.getModal().getByRole('button', { name: /delete feed/i });
  }

  getCancelButton() {
    return this.getModal().getByRole('button', { name: /cancel/i });
  }

  getWarningMessage() {
    return this.getModal().getByText(/are you sure you want to delete this feed/i);
  }

  getFeedTitle() {
    return this.getModal().locator('.font-medium');
  }

  getFeedUrl() {
    return this.getModal().locator('.text-base-content-gray');
  }

  getWarningAlert() {
    return this.getModal().locator('.alert-warning');
  }

  async waitForModalToClose() {
    await this.page.waitForFunction(() => {
      const modal = document.querySelector('dialog[open]');
      return !modal;
    });
  }

  async clickConfirm() {
    await this.getConfirmButton().click();
  }

  async clickCancel() {
    await this.getCancelButton().click();
  }

  async isDeleting() {
    const button = this.getConfirmButton();
    const text = await button.textContent();
    return text?.toLowerCase().includes('deleting') ?? false;
  }
}
