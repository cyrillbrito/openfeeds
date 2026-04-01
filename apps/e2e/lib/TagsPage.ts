import type { Page } from '@playwright/test';

export class TagsPage {
  constructor(private page: Page) {}

  getCreateTagButton() {
    return this.page.getByRole('button', { name: /create tag/i });
  }

  getCreateFirstTagButton() {
    return this.page.getByRole('button', { name: /create your first tag/i });
  }

  getEmptyStateHeading() {
    return this.page.getByRole('heading', { name: 'No Tags Yet' });
  }

  getEmptyStateDescription() {
    return this.page.getByText('Create tags to organize and categorize your RSS feeds');
  }

  getTagHeading(tagName: string) {
    return this.page.getByRole('heading', { name: tagName });
  }

  getCreateTagModal() {
    return this.page.getByRole('dialog');
  }

  getTagNameInput() {
    return this.getCreateTagModal().getByPlaceholder(/enter tag name/i);
  }

  getColorSelect() {
    return this.getCreateTagModal().locator('select[name="color"]');
  }

  getColorButton(color: string) {
    return this.getCreateTagModal().getByRole('button', { name: new RegExp(`^${color}$`, 'i') });
  }

  getDefaultColorButton() {
    return this.getCreateTagModal().getByRole('button', { name: /^default$/i });
  }

  isColorSelected(color: string) {
    const colorBtn =
      color === 'default' ? this.getDefaultColorButton() : this.getColorButton(color);
    return colorBtn.evaluate((el) => el.className.includes('ring-2'));
  }

  getSubmitButton() {
    return this.page.getByRole('button', { name: /^create tag$/i }).last();
  }

  getCancelButton() {
    return this.page.getByRole('button', { name: /^cancel$/i }).last();
  }

  getErrorMessage() {
    return this.page.getByText(/tag name already exists/i);
  }

  getTagCard(tagName: string) {
    return this.page.locator('.card').filter({ hasText: tagName });
  }

  getTagDropdownButton(tagName: string) {
    return this.getTagCard(tagName).getByRole('button').last();
  }

  getDeleteButton(tagName: string) {
    return this.page
      .locator('div')
      .filter({ hasText: new RegExp(`^${tagName}EditDelete$`) })
      .getByRole('button')
      .filter({ hasText: 'Delete' });
  }

  getDeleteModal() {
    return this.page.locator('[role="dialog"]').filter({ hasText: 'Delete Tag' });
  }

  getDeleteConfirmButton() {
    return this.getDeleteModal().getByRole('button', { name: /delete tag/i });
  }

  getDeleteCancelButton() {
    return this.getDeleteModal().getByRole('button', { name: /cancel/i });
  }

  async goto() {
    await this.page.goto('/tags');
  }

  async openCreateModal() {
    await this.getCreateTagButton().click();
  }

  async createTag(name: string, color?: string) {
    await this.openCreateModal();
    await this.getTagNameInput().fill(name);

    if (color) {
      await this.getColorButton(color).click();
    }

    await this.getSubmitButton().click();
  }

  async waitForModalToClosed() {
    await this.page.waitForFunction(() => {
      const modal = document.querySelector('[role="dialog"]');
      return !modal || !modal.classList.contains('modal-open');
    });
  }

  async deleteTag(tagName: string) {
    await this.getTagDropdownButton(tagName).click();
    await this.getDeleteButton(tagName).click();
    await this.getDeleteConfirmButton().click();
  }

  async openDeleteModal(tagName: string) {
    await this.getTagDropdownButton(tagName).click();
    await this.getDeleteButton(tagName).click();
  }

  async waitForDeleteModalToClosed() {
    await this.page.waitForFunction(() => {
      const modal = document.querySelector('[role="dialog"]');
      return !modal || !modal.classList.contains('modal-open');
    });
  }
}
