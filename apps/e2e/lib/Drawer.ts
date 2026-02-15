import type { Page } from '@playwright/test';

export class Drawer {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Navigation Links
  getArticlesLink() {
    return this.page.getByRole('link', { name: 'All Articles' });
  }

  getDiscoverButton() {
    return this.page.getByRole('button', { name: 'Discover' });
  }

  getFeedsLink() {
    return this.page.getByRole('link', { name: 'Manage Feeds' });
  }

  // Tags Section
  getTagsLink() {
    return this.page.getByRole('link', { name: 'Tags' });
  }

  getAddTagButton() {
    return this.page.getByRole('button', { name: 'Add new tag' });
  }

  getTagLink(tagName: string) {
    return this.page.getByRole('link', { name: tagName }).last();
  }

  // User Menu
  getUserEmail() {
    return this.page.getByTestId('user-email');
  }

  getUserMenu() {
    return this.page.locator('.dropdown').filter({ hasText: this.page.getByTestId('user-email') });
  }

  getUserInitials() {
    return this.page.locator('.avatar-placeholder .text-xs');
  }

  // Actions
  async openAddTagModal() {
    await this.getAddTagButton().click();
  }

  async navigateToTags() {
    await this.getTagsLink().click();
  }

  async navigateToArticles() {
    await this.getArticlesLink().click();
  }

  async navigateToFeeds() {
    await this.getFeedsLink().click();
  }

  async openDiscover() {
    await this.getDiscoverButton().click();
  }
}
