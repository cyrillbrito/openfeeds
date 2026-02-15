import type { Page } from '@playwright/test';

export class AddFeedModal {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  getModal() {
    return this.page.locator('dialog').filter({ hasText: 'Add New RSS Feed' });
  }

  getFeedUrlInput() {
    return this.getModal().getByPlaceholder(/https:\/\/example.com/i);
  }

  getFindFeedsButton() {
    return this.getModal().getByRole('button', { name: /find feeds/i });
  }

  getAddFeedButton() {
    return this.getModal().getByRole('button', { name: /add feed/i });
  }

  getAddUrlDirectlyButton() {
    return this.getModal().getByRole('button', { name: /add url directly/i });
  }

  getCancelButton() {
    return this.getModal()
      .getByRole('button', { name: /cancel/i })
      .first();
  }

  getBackButton() {
    return this.getModal().getByRole('button', { name: /back/i });
  }

  getErrorAlert() {
    return this.getModal().locator('.alert-error');
  }

  getSuccessAlert() {
    return this.getModal().locator('.alert-success');
  }

  getInfoAlert() {
    return this.getModal().locator('.alert-info');
  }

  getDiscoveredFeed(feedUrl: string) {
    return this.getModal().getByText(feedUrl);
  }

  async waitForModalToClose() {
    await this.page.waitForFunction(() => {
      const modal = document.querySelector('dialog[open]');
      return !modal;
    });
  }

  async fillFeedUrl(url: string) {
    await this.getFeedUrlInput().fill(url);
  }

  async clickFindFeeds() {
    await this.getFindFeedsButton().click();
  }

  async clickAddFeed() {
    await this.getAddFeedButton().click();
  }

  async clickAddUrlDirectly() {
    await this.getAddUrlDirectlyButton().click();
  }

  async clickCancel() {
    await this.getCancelButton().click();
  }

  async clickBack() {
    await this.getBackButton().click();
  }

  async addFeedByUrl(url: string) {
    await this.fillFeedUrl(url);
    await this.clickFindFeeds();
    // Wait for feed discovery
    await this.page.waitForTimeout(1000);
    await this.clickAddFeed();
    await this.waitForModalToClose();
  }
}
