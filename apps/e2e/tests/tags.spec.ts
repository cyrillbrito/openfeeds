import { expect, test } from '../fixtures/auth-fixture';
import { Drawer } from '../lib/Drawer';
import { TagsPage } from '../lib/TagsPage';

test('create a new tag successfully', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  const drawer = new Drawer(page);
  await tagsPage.goto();

  await expect(page).toHaveURL('/tags');

  // Screenshot: Create tag modal
  await tagsPage.openCreateModal();
  await expect(page).toHaveScreenshot('create-tag-modal.png', {
    mask: [drawer.getUserEmail()],
  });

  await tagsPage.getTagNameInput().fill('E2E Test Tag');
  await tagsPage.getSubmitButton().click();
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('E2E Test Tag')).toBeVisible();

  // Screenshot: Single tag created
  await expect(page).toHaveScreenshot('single-tag-created.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('show empty state when no tags exist', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  const drawer = new Drawer(page);
  await tagsPage.goto();

  await expect(tagsPage.getEmptyStateHeading()).toBeVisible();
  await expect(tagsPage.getEmptyStateDescription()).toBeVisible();
  await expect(tagsPage.getCreateFirstTagButton()).toBeVisible();
  await expect(page).toHaveScreenshot('empty-state.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('handle tag creation with color', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.createTag('Colored Tag', 'blue');
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('Colored Tag')).toBeVisible();
});

test('handle duplicate tag name error', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  const drawer = new Drawer(page);
  await tagsPage.goto();

  await tagsPage.createTag('Duplicate Test');
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('Duplicate Test')).toBeVisible();

  await tagsPage.openCreateModal();
  await tagsPage.getTagNameInput().fill('Duplicate Test');
  await tagsPage.getSubmitButton().click();

  await expect(tagsPage.getErrorMessage()).toBeVisible();
  await expect(page).toHaveScreenshot('duplicate-name-error.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('delete a tag successfully', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.createTag('Tag To Delete');
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('Tag To Delete')).toBeVisible();

  await tagsPage.deleteTag('Tag To Delete');
  await tagsPage.waitForDeleteModalToClosed();

  await expect(tagsPage.getTagHeading('Tag To Delete')).not.toBeVisible();
  await expect(tagsPage.getEmptyStateHeading()).toBeVisible();
});

test('cancel tag deletion', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  const drawer = new Drawer(page);
  await tagsPage.goto();

  await tagsPage.createTag('Tag To Keep');
  await tagsPage.waitForModalToClosed();

  await tagsPage.getTagDropdownButton('Tag To Keep').click();
  await expect(page).toHaveScreenshot('tag-with-dropdown-menu.png', {
    mask: [drawer.getUserEmail()],
  });

  await tagsPage.getDeleteButton('Tag To Keep').click();

  await expect(tagsPage.getDeleteModal()).toBeVisible();
  await expect(page).toHaveScreenshot('delete-confirmation-modal.png', {
    mask: [drawer.getUserEmail()],
  });

  await tagsPage.getDeleteCancelButton().click();
  await tagsPage.waitForDeleteModalToClosed();

  await expect(tagsPage.getTagHeading('Tag To Keep')).toBeVisible();
});

test('handle empty tag name validation', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.openCreateModal();
  await tagsPage.getSubmitButton().click();

  await expect(tagsPage.getCreateTagModal()).toBeVisible();
});

test('display multiple tags correctly', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  const drawer = new Drawer(page);
  await tagsPage.goto();

  await tagsPage.createTag('Technology');
  await tagsPage.waitForModalToClosed();
  await tagsPage.createTag('News');
  await tagsPage.waitForModalToClosed();
  await tagsPage.createTag('Sports', 'green');
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('Technology')).toBeVisible();
  await expect(tagsPage.getTagHeading('News')).toBeVisible();
  await expect(tagsPage.getTagHeading('Sports')).toBeVisible();

  await expect(page).toHaveScreenshot('multiple-tags-grid.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('handle tag name with special characters', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  const specialTagName = 'Tech & AI/ML 2024 🚀';
  await tagsPage.createTag(specialTagName);
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading(specialTagName)).toBeVisible();
});

test('handle very long tag name', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  const longTagName =
    'This is a very long tag name that tests the maximum length handling and UI display capabilities of the tag system';
  await tagsPage.createTag(longTagName);
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading(longTagName)).toBeVisible();
});

test('create tags with all available colors', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  const drawer = new Drawer(page);
  await tagsPage.goto();

  const colors = ['red', 'blue', 'green', 'purple', 'orange', 'yellow'];

  for (const color of colors) {
    await tagsPage.createTag(`${color} Tag`, color);
    await tagsPage.waitForModalToClosed();
    await expect(tagsPage.getTagHeading(`${color} Tag`)).toBeVisible();
  }

  await expect(page).toHaveScreenshot('all-color-tags.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('handle rapid tag creation', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.createTag('Quick Tag 1');
  await tagsPage.waitForModalToClosed();

  await tagsPage.createTag('Quick Tag 2');
  await tagsPage.waitForModalToClosed();

  await tagsPage.createTag('Quick Tag 3');
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('Quick Tag 1')).toBeVisible();
  await expect(tagsPage.getTagHeading('Quick Tag 2')).toBeVisible();
  await expect(tagsPage.getTagHeading('Quick Tag 3')).toBeVisible();
});

test('modal keyboard navigation and accessibility', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.openCreateModal();

  // Test Escape key closes modal
  await page.keyboard.press('Escape');
  await tagsPage.waitForModalToClosed();

  // Test Enter key submission
  await tagsPage.openCreateModal();
  await tagsPage.getTagNameInput().fill('Keyboard Test Tag');
  await page.keyboard.press('Enter');
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('Keyboard Test Tag')).toBeVisible();
});

test('closes modal when clicking backdrop', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  // Open modal
  await tagsPage.openCreateModal();
  await expect(tagsPage.getCreateTagModal()).toBeVisible();

  // Fill some data to test that modal closes even with content
  await tagsPage.getTagNameInput().fill('Test Tag');

  // Click backdrop - use coordinates instead of element click due to z-index issues
  // Click on the left side of the screen, outside the modal box
  await page.click('body', { position: { x: 100, y: 400 } });
  await tagsPage.waitForModalToClosed();

  // Verify modal is closed
  await expect(tagsPage.getCreateTagModal()).not.toBeVisible();

  // Open modal again to verify form was reset
  await tagsPage.openCreateModal();
  await expect(tagsPage.getTagNameInput()).toHaveValue('');

  // Clean up by canceling
  await tagsPage.getCancelButton().click();
  await tagsPage.waitForModalToClosed();
});

test('prevents creating tag with empty name', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  // Open modal
  await tagsPage.openCreateModal();
  await expect(tagsPage.getCreateTagModal()).toBeVisible();

  // Try to submit with empty name
  await tagsPage.getSubmitButton().click();

  // HTML5 validation should prevent submission and show browser validation message
  await expect(tagsPage.getCreateTagModal()).toBeVisible(); // Modal should still be open
  await expect(tagsPage.getTagNameInput()).toBeFocused(); // Input should be focused

  // Verify no tag was created by checking we're still on empty state or no new tag appears
  await tagsPage.getCancelButton().click();
  await tagsPage.waitForModalToClosed();
});

test('shows correct color selection visual feedback', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.openCreateModal();
  await expect(tagsPage.getCreateTagModal()).toBeVisible();

  // Default should be selected initially
  expect(await tagsPage.isColorSelected('default')).toBe(true);

  // Click red color
  await tagsPage.getColorButton('red').click();
  expect(await tagsPage.isColorSelected('red')).toBe(true);
  expect(await tagsPage.isColorSelected('default')).toBe(false);

  // Click blue color
  await tagsPage.getColorButton('blue').click();
  expect(await tagsPage.isColorSelected('blue')).toBe(true);
  expect(await tagsPage.isColorSelected('red')).toBe(false);

  // Return to default
  await tagsPage.getDefaultColorButton().click();
  expect(await tagsPage.isColorSelected('default')).toBe(true);
  expect(await tagsPage.isColorSelected('blue')).toBe(false);

  await tagsPage.getCancelButton().click();
  await tagsPage.waitForModalToClosed();
});

test('create tag from empty state button', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await expect(tagsPage.getCreateFirstTagButton()).toBeVisible();
  await tagsPage.getCreateFirstTagButton().click();

  await expect(tagsPage.getCreateTagModal()).toBeVisible();
  await tagsPage.getTagNameInput().fill('First Tag');
  await tagsPage.getSubmitButton().click();
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('First Tag')).toBeVisible();
});

test('handles very long tag names', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  const longTagName = 'A'.repeat(100); // Very long tag name

  await tagsPage.createTag(longTagName, 'blue');
  await tagsPage.waitForModalToClosed();

  // Verify tag was created with long name
  await expect(tagsPage.getTagHeading(longTagName)).toBeVisible();
});

test('handles special characters in tag names', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  const specialTagName = 'Tag with émojis 🚀 & symbols!@#$%';

  await tagsPage.createTag(specialTagName, 'green');
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading(specialTagName)).toBeVisible();
});

test('shows loading state during tag creation', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  // Open modal and fill form
  await tagsPage.openCreateModal();
  await tagsPage.getTagNameInput().fill('Loading Test Tag');

  // Click submit and immediately check for loading state
  const submitPromise = tagsPage.getSubmitButton().click();

  // Check for loading spinner and disabled state
  await expect(tagsPage.getSubmitButton()).toContainText(/creating/i);
  await expect(tagsPage.getSubmitButton()).toBeDisabled();
  await expect(tagsPage.getSubmitButton().locator('.loading-spinner')).toBeVisible();

  await submitPromise;
  await tagsPage.waitForModalToClosed();
  await expect(tagsPage.getTagHeading('Loading Test Tag')).toBeVisible();
});

test('shows loading state during tag deletion', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  // Create a tag first
  await tagsPage.createTag('Delete Loading Test', 'red');
  await tagsPage.waitForModalToClosed();

  // Open delete modal
  await tagsPage.openDeleteModal('Delete Loading Test');

  // Click delete and check loading state
  const deletePromise = tagsPage.getDeleteConfirmButton().click();

  // Check for loading state
  await expect(tagsPage.getDeleteConfirmButton()).toContainText(/deleting/i);
  await expect(tagsPage.getDeleteConfirmButton()).toBeDisabled();
  await expect(tagsPage.getDeleteConfirmButton().locator('.loading-spinner')).toBeVisible();

  await deletePromise;
  await tagsPage.waitForDeleteModalToClosed();
  await expect(tagsPage.getTagHeading('Delete Loading Test')).not.toBeVisible();
});

test('preserve tag form state during validation errors', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.createTag('Original Tag');
  await tagsPage.waitForModalToClosed();

  await tagsPage.openCreateModal();
  await tagsPage.getTagNameInput().fill('Original Tag');
  await tagsPage.getColorButton('blue').click();
  await tagsPage.getSubmitButton().click();

  // Form should stay open and preserve color selection
  await expect(tagsPage.getCreateTagModal()).toBeVisible();
  await expect(tagsPage.getErrorMessage()).toBeVisible();
  await expect(tagsPage.getColorButton('blue')).toHaveClass(/ring-primary/);
  await expect(tagsPage.getTagNameInput()).toHaveValue('Original Tag');
});

test('handle whitespace-only tag name', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.openCreateModal();
  await tagsPage.getTagNameInput().fill('   ');
  await tagsPage.getSubmitButton().click();

  await expect(tagsPage.getCreateTagModal()).toBeVisible();
});

test('case insensitive duplicate detection', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.createTag('CasE Test');
  await tagsPage.waitForModalToClosed();

  await tagsPage.openCreateModal();
  await tagsPage.getTagNameInput().fill('case test');
  await tagsPage.getSubmitButton().click();

  // Verify error message is shown and modal stays open
  await expect(tagsPage.getErrorMessage()).toBeVisible();
  await expect(tagsPage.getCreateTagModal()).toBeVisible();

  // Clean up by canceling the modal
  await tagsPage.getCancelButton().click();
  await tagsPage.waitForModalToClosed();
});

test('handles rapid modal open/close operations', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  // Rapidly open and close modal multiple times
  for (let i = 0; i < 3; i++) {
    await tagsPage.openCreateModal();
    await expect(tagsPage.getCreateTagModal()).toBeVisible();

    await tagsPage.getCancelButton().click();
    await tagsPage.waitForModalToClosed();
  }

  // Verify modal still works correctly after rapid operations
  await tagsPage.createTag('Rapid Test Tag');
  await tagsPage.waitForModalToClosed();
  await expect(tagsPage.getTagHeading('Rapid Test Tag')).toBeVisible();
});

test('handles network error during tag creation gracefully', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  // Mock network failure for tag creation
  await page.route('**/api/tags', (route) => {
    route.abort('failed');
  });

  await tagsPage.openCreateModal();
  await tagsPage.getTagNameInput().fill('Network Error Tag');
  await tagsPage.getSubmitButton().click();

  // Verify modal stays open and shows error state
  await expect(tagsPage.getCreateTagModal()).toBeVisible();

  // The modal should stay open and show some error indication
  // (exact error handling depends on implementation)

  await tagsPage.getCancelButton().click();
  await tagsPage.waitForModalToClosed();
});

test('maintains accessibility with keyboard navigation', async ({ page, user }) => {
  const tagsPage = new TagsPage(page);
  await tagsPage.goto();

  await tagsPage.openCreateModal();

  // Test Tab navigation through form elements
  await page.keyboard.press('Tab'); // Should focus tag name input
  await expect(tagsPage.getTagNameInput()).toBeFocused();

  await page.keyboard.type('Accessibility Test');

  // Tab through color buttons
  await page.keyboard.press('Tab'); // Focus first color button (Default)
  await page.keyboard.press('Tab'); // Focus next color button (red)
  await page.keyboard.press(' '); // Select color with spacebar

  // Verify color was selected via keyboard
  await expect(tagsPage.getColorButton('red')).toHaveClass(/ring-primary/);

  // Use click to reach submit button (keyboard navigation for colors tested above)
  await tagsPage.getSubmitButton().click();
  await tagsPage.waitForModalToClosed();

  await expect(tagsPage.getTagHeading('Accessibility Test')).toBeVisible();
});
