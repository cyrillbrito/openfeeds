import type { Page } from '@playwright/test';

export class FeedsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Main page elements
  getImportOpmlButton() {
    return this.page.getByRole('button', { name: /import opml/i }).first();
  }

  getAddFeedButton() {
    return this.page.getByRole('button', { name: /add feed/i });
  }

  getEmptyStateHeading() {
    return this.page.getByRole('heading', { name: /no rss feeds yet/i });
  }

  getSearchInput() {
    return this.page.getByPlaceholder(/search feeds/i);
  }

  // Import OPML Modal elements
  getImportModal() {
    return this.page.locator('dialog').filter({ hasText: 'Import OPML File' });
  }

  getFileInput() {
    return this.getImportModal().locator('input[type="file"]');
  }

  getSuccessMessage() {
    return this.getImportModal().getByText(/successfully imported/i);
  }

  getFailedMessage() {
    return this.getImportModal().getByText(/failed to import/i);
  }

  getImportDoneButton() {
    return this.getImportModal().getByRole('button', { name: /done/i });
  }

  getImportCancelButton() {
    return this.getImportModal().getByRole('button', { name: /cancel/i });
  }

  getImportErrorAlert() {
    return this.getImportModal().locator('.alert-error');
  }

  // Feed list elements
  getFeedByTitle(title: string) {
    return this.page.getByRole('link', { name: title });
  }

  getFeedCards() {
    return this.page.locator('.card');
  }

  getFirstFeedCard() {
    return this.getFeedCards().first();
  }

  getFeedCount() {
    return this.page.locator('.card').count();
  }

  // Navigation
  async goto() {
    await this.page.goto('/feeds');
  }

  // Actions
  async openImportModal() {
    await this.getImportOpmlButton().click();
  }

  async importOpmlFile(filePath: string) {
    await this.openImportModal();
    await this.getFileInput().setInputFiles(filePath);
  }

  async waitForModalToClosed() {
    await this.page.waitForFunction(() => {
      const modal = document.querySelector('dialog[open]');
      return !modal;
    });
  }

  // Feed card actions
  getFeedDropdownButton(feedTitle: string) {
    // Find the feed card by title link, then find the dropdown button within that card
    // The dropdown button is in an absolutely positioned div at the top-right
    const feedLink = this.page.getByRole('link', { name: feedTitle });
    // Navigate to the card container, then find the button with ellipsis icon
    return feedLink
      .locator('xpath=ancestor::div[contains(@class, "card")]')
      .locator('div[class*="absolute"]')
      .getByRole('button')
      .first();
  }

  getEditFeedMenuItem() {
    return this.page.getByRole('button', { name: /edit feed/i });
  }

  getDeleteFeedMenuItem() {
    return this.page.getByRole('button', { name: /delete feed/i });
  }

  // Actions
  async openAddFeedModal() {
    await this.getAddFeedButton().click();
  }

  async openEditFeedModal(feedTitle: string) {
    await this.getFeedDropdownButton(feedTitle).click();
    await this.getEditFeedMenuItem().click();
  }

  async openDeleteFeedModal(feedTitle: string) {
    await this.getFeedDropdownButton(feedTitle).click();
    await this.getDeleteFeedMenuItem().click();
  }
}
