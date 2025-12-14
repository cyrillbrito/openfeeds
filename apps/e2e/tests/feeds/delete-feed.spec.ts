import { expect, test } from '../../fixtures/auth-fixture';
import { AddFeedModal } from '../../lib/AddFeedModal';
import { DeleteFeedModal } from '../../lib/DeleteFeedModal';
import { Drawer } from '../../lib/Drawer';
import { FeedsPage } from '../../lib/FeedsPage';
import { MOCK_SERVER_URL } from '../../mock-server/server';

let feedsPage: FeedsPage;
let deleteFeedModal: DeleteFeedModal;
let addFeedModal: AddFeedModal;

test.beforeEach(async ({ page, user }) => {
  feedsPage = new FeedsPage(page);
  deleteFeedModal = new DeleteFeedModal(page);
  addFeedModal = new AddFeedModal(page);
  await feedsPage.goto();

  // Set up a feed for each test
  const feedUrl = `${MOCK_SERVER_URL}/tech-blog.xml`;
  await feedsPage.openAddFeedModal();
  await addFeedModal.addFeedByUrl(feedUrl);
  // Wait for feed to be added
  await expect(feedsPage.getFeedCards().first()).toBeVisible({ timeout: 10000 });
});

test('display delete feed modal', async ({ page, user }) => {
  const drawer = new Drawer(page);
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedTitle = await firstFeedCard.getByRole('heading').first().textContent();

  await feedsPage.openDeleteFeedModal(feedTitle!.trim());

  await expect(deleteFeedModal.getModal()).toBeVisible();
  await expect(deleteFeedModal.getConfirmButton()).toBeVisible();
  await expect(deleteFeedModal.getCancelButton()).toBeVisible();
  await expect(deleteFeedModal.getWarningMessage()).toBeVisible();

  await expect(page).toHaveScreenshot('delete-feed-modal-opened.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('cancel feed deletion', async ({ page, user }) => {
  const initialFeedCount = await feedsPage.getFeedCount();
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedTitle = await firstFeedCard.getByRole('heading').first().textContent();

  await feedsPage.openDeleteFeedModal(feedTitle!.trim());
  await expect(deleteFeedModal.getModal()).toBeVisible();

  await deleteFeedModal.clickCancel();
  await deleteFeedModal.waitForModalToClose();

  await expect(deleteFeedModal.getModal()).not.toBeVisible();

  // Feed count should remain the same
  const finalFeedCount = await feedsPage.getFeedCount();
  expect(finalFeedCount).toBe(initialFeedCount);
});

test('delete feed successfully', async ({ page, user }) => {
  const initialFeedCount = await feedsPage.getFeedCount();
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedTitle = await firstFeedCard.getByRole('heading').first().textContent();

  await feedsPage.openDeleteFeedModal(feedTitle!.trim());
  await expect(deleteFeedModal.getModal()).toBeVisible();

  await deleteFeedModal.clickConfirm();
  await deleteFeedModal.waitForModalToClose();

  // Wait for feed to be removed
  await page.waitForTimeout(500);

  // Feed count should decrease
  const finalFeedCount = await feedsPage.getFeedCount();
  expect(finalFeedCount).toBe(initialFeedCount - 1);

  // Deleted feed should not be visible
  await expect(feedsPage.getFeedByTitle(feedTitle!.trim())).not.toBeVisible();
});

test('show loading state during deletion', async ({ page, user }) => {
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedTitle = await firstFeedCard.getByRole('heading').first().textContent();

  await feedsPage.openDeleteFeedModal(feedTitle!.trim());

  // Click delete and immediately check for loading state
  const deletePromise = deleteFeedModal.clickConfirm();

  // Check for loading state
  await expect(deleteFeedModal.getConfirmButton()).toContainText(/deleting/i);
  await expect(deleteFeedModal.getConfirmButton()).toBeDisabled();

  await deletePromise;
  await deleteFeedModal.waitForModalToClose();
});
