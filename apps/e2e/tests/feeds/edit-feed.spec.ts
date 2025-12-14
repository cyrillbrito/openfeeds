import { expect, test } from '../../fixtures/auth-fixture';
import { AddFeedModal } from '../../lib/AddFeedModal';
import { Drawer } from '../../lib/Drawer';
import { EditFeedModal } from '../../lib/EditFeedModal';
import { FeedsPage } from '../../lib/FeedsPage';
import { MOCK_SERVER_URL } from '../../mock-server/server';

let feedsPage: FeedsPage;
let editFeedModal: EditFeedModal;
let addFeedModal: AddFeedModal;

test.beforeEach(async ({ page, user }) => {
  feedsPage = new FeedsPage(page);
  editFeedModal = new EditFeedModal(page);
  addFeedModal = new AddFeedModal(page);
  await feedsPage.goto();

  // Set up a feed for each test
  const feedUrl = `${MOCK_SERVER_URL}/tech-blog.xml`;
  await feedsPage.openAddFeedModal();
  await addFeedModal.addFeedByUrl(feedUrl);
  // Wait for feed to be added
  await expect(feedsPage.getFeedCards().first()).toBeVisible({ timeout: 10000 });
});

test('display edit feed modal', async ({ page, user }) => {
  const drawer = new Drawer(page);
  // Get the first feed's title
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedTitle = await firstFeedCard.getByRole('heading').first().textContent();

  await feedsPage.openEditFeedModal(feedTitle!.trim());

  await expect(editFeedModal.getModal()).toBeVisible();
  await expect(editFeedModal.getDoneButton()).toBeVisible();

  await expect(page).toHaveScreenshot('edit-feed-modal-opened.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('close edit feed modal with done button', async ({ page, user }) => {
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedTitle = await firstFeedCard.getByRole('heading').first().textContent();

  await feedsPage.openEditFeedModal(feedTitle!.trim());
  await expect(editFeedModal.getModal()).toBeVisible();

  await editFeedModal.clickDone();
  await editFeedModal.waitForModalToClose();

  await expect(editFeedModal.getModal()).not.toBeVisible();
});

test('edit feed tags', async ({ page, user }) => {
  // First create a tag
  await page.goto('/tags');
  await page.getByRole('button', { name: /create tag/i }).click();
  await page.getByPlaceholder(/tag name/i).fill('Test Tag');
  await page.getByRole('button', { name: /create/i }).click();
  await page.waitForTimeout(500);

  // Go back to feeds
  await feedsPage.goto();

  // Open edit modal for first feed
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedTitle = await firstFeedCard.getByRole('heading').first().textContent();

  await feedsPage.openEditFeedModal(feedTitle!.trim());
  await expect(editFeedModal.getModal()).toBeVisible();

  // Select the tag using the modal's method
  await editFeedModal.selectTag('Test Tag');

  // Save tags if save button is visible
  const saveTagsButton = editFeedModal.getSaveTagsButton();
  if (await saveTagsButton.isVisible().catch(() => false)) {
    await editFeedModal.clickSaveTags();
    await page.waitForTimeout(500);
  }

  // Close modal
  await editFeedModal.clickDone();
  await editFeedModal.waitForModalToClose();
});
