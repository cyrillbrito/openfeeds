import path from 'path';
import { expect, test } from '../fixtures/auth-fixture';
import { Drawer } from '../lib/Drawer';
import { FeedsPage } from '../lib/FeedsPage';

/**
 * These tests use the Mock Server (localhost:9999) to provide reliable RSS feeds.
 * The Mock Server is automatically started/stopped by Playwright's global setup/teardown.
 */

test('import OPML file successfully', async ({ page, user }) => {
  const feedsPage = new FeedsPage(page);
  const drawer = new Drawer(page);
  await feedsPage.goto();

  // Verify we're on the feeds page
  await expect(page).toHaveURL('/feeds');

  // Open import modal
  await feedsPage.openImportModal();
  await expect(feedsPage.getImportModal()).toBeVisible();

  // Screenshot: Import modal opened
  await expect(page).toHaveScreenshot('import-modal-opened.png', {
    mask: [drawer.getUserEmail()],
  });

  // Import OPML file
  const opmlFilePath = path.join(__dirname, '../fixtures/test-feeds.opml');
  await feedsPage.getFileInput().setInputFiles(opmlFilePath);

  // Wait for import to complete - modal auto-closes on full success
  await feedsPage.waitForModalToClosed();

  // Wait for at least one feed card to appear
  await expect(feedsPage.getFirstFeedCard()).toBeVisible();
});

// Note: Progress test removed - import is too fast with localhost Mock Server to reliably test progress UI

test('handle invalid OPML file', async ({ page, user }) => {
  const feedsPage = new FeedsPage(page);
  const drawer = new Drawer(page);
  await feedsPage.goto();

  await feedsPage.openImportModal();

  // Create a temporary invalid OPML file
  const invalidOpmlPath = path.join(__dirname, '../fixtures/invalid.opml');

  // Set the invalid file
  await feedsPage.getFileInput().setInputFiles(invalidOpmlPath);

  // Expect error to be shown
  await expect(feedsPage.getImportErrorAlert()).toBeVisible({ timeout: 10000 });

  // Screenshot: Error state
  await expect(page).toHaveScreenshot('import-error.png', {
    mask: [drawer.getUserEmail()],
  });

  // Close modal
  await feedsPage.getImportCancelButton().click();
  await feedsPage.waitForModalToClosed();
});

test('import OPML with categories creates tags', async ({ page, user }) => {
  const feedsPage = new FeedsPage(page);
  await feedsPage.goto();

  // Import OPML file with categories
  const opmlFilePath = path.join(__dirname, '../fixtures/test-feeds.opml');
  await feedsPage.importOpmlFile(opmlFilePath);

  // Wait for import to complete - modal auto-closes on full success
  await feedsPage.waitForModalToClosed();

  // Navigate to tags page to verify tags were created from categories
  await page.goto('/tags');

  // Verify Technology, News, and Podcasts tags were created
  await expect(page.getByRole('heading', { name: 'Technology' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'News' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Podcasts' })).toBeVisible();
});

test('import from empty state', async ({ page, user }) => {
  const feedsPage = new FeedsPage(page);
  await feedsPage.goto();

  // Verify empty state
  await expect(feedsPage.getEmptyStateHeading()).toBeVisible();

  // Click import from empty state
  await feedsPage.getImportOpmlButton().click();

  await expect(feedsPage.getImportModal()).toBeVisible();

  // Import OPML
  const opmlFilePath = path.join(__dirname, '../fixtures/test-feeds.opml');
  await feedsPage.getFileInput().setInputFiles(opmlFilePath);

  // Wait for completion - modal auto-closes on full success
  await feedsPage.waitForModalToClosed();

  // Wait for at least one feed card to appear
  await expect(feedsPage.getFirstFeedCard()).toBeVisible();
});

test('cancel OPML import', async ({ page, user }) => {
  const feedsPage = new FeedsPage(page);
  await feedsPage.goto();

  await feedsPage.openImportModal();
  await expect(feedsPage.getImportModal()).toBeVisible();

  // Click cancel without importing
  await feedsPage.getImportCancelButton().click();
  await feedsPage.waitForModalToClosed();

  // Modal should be closed
  await expect(feedsPage.getImportModal()).not.toBeVisible();
});
