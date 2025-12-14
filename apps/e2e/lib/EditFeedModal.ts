import { Page } from '@playwright/test';

export class EditFeedModal {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  getModal() {
    return this.page.locator('dialog').filter({ hasText: 'Edit Feed' });
  }

  getDoneButton() {
    return this.getModal().getByRole('button', { name: /done/i });
  }

  getSaveTagsButton() {
    return this.getModal().getByRole('button', { name: /save tags/i });
  }

  getResetButton() {
    return this.getModal().getByRole('button', { name: /reset/i });
  }

  getTagsTab() {
    return this.getModal().getByRole('button', { name: /tags/i });
  }

  getRulesTab() {
    return this.getModal().getByRole('button', { name: /rules/i });
  }

  getTagCheckbox(tagName: string) {
    return this.getModal().getByRole('checkbox', { name: new RegExp(tagName, 'i') });
  }

  async waitForModalToClose() {
    await this.page.waitForFunction(() => {
      const modal = document.querySelector('dialog[open]');
      return !modal;
    });
  }

  async clickDone() {
    await this.getDoneButton().click();
  }

  async clickSaveTags() {
    await this.getSaveTagsButton().click();
  }

  async clickReset() {
    await this.getResetButton().click();
  }

  async selectTag(tagName: string) {
    const checkbox = this.getTagCheckbox(tagName);
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.check();
    }
  }

  async deselectTag(tagName: string) {
    const checkbox = this.getTagCheckbox(tagName);
    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.uncheck();
    }
  }
}
