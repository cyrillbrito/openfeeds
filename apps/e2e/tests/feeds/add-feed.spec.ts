import { expect, test } from '../../fixtures/auth-fixture';
import { AddFeedModal } from '../../lib/AddFeedModal';
import { Drawer } from '../../lib/Drawer';
import { FeedsPage } from '../../lib/FeedsPage';
import { MOCK_SERVER_URL } from '../../mock-server/server';

let feedsPage: FeedsPage;
let addFeedModal: AddFeedModal;

test.beforeEach(async ({ page, user }) => {
  feedsPage = new FeedsPage(page);
  addFeedModal = new AddFeedModal(page);
  await feedsPage.goto();
});

test('display add feed modal', async ({ page, user }) => {
  const drawer = new Drawer(page);
  await feedsPage.openAddFeedModal();

  await expect(addFeedModal.getModal()).toBeVisible();
  await expect(addFeedModal.getFeedUrlInput()).toBeVisible();
  await expect(addFeedModal.getFindFeedsButton()).toBeVisible();
  await expect(addFeedModal.getCancelButton()).toBeVisible();

  await expect(page).toHaveScreenshot('add-feed-modal-opened.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('add feed by URL successfully', async ({ page, user }) => {
  const feedUrl = `${MOCK_SERVER_URL}/tech-blog.xml`;
  await feedsPage.openAddFeedModal();
  await addFeedModal.addFeedByUrl(feedUrl);

  // Wait for feed to appear in the list
  await expect(feedsPage.getFeedCards().first()).toBeVisible({ timeout: 10000 });
  await expect(addFeedModal.getModal()).not.toBeVisible();
});

test('validate required URL field', async ({ page, user }) => {
  await feedsPage.openAddFeedModal();
  await addFeedModal.clickFindFeeds();

  // Browser's native validation should prevent submission
  await expect(addFeedModal.getFeedUrlInput()).toBeFocused();
});

test('handle invalid feed URL', async ({ page, user }) => {
  await feedsPage.openAddFeedModal();
  await addFeedModal.fillFeedUrl('not-a-valid-url');
  await addFeedModal.clickFindFeeds();

  // Should show error or stay on same step
  await expect(addFeedModal.getModal()).toBeVisible();
});

test('cancel add feed modal', async ({ page, user }) => {
  await feedsPage.openAddFeedModal();
  await expect(addFeedModal.getModal()).toBeVisible();

  await addFeedModal.clickCancel();
  await addFeedModal.waitForModalToClose();

  await expect(addFeedModal.getModal()).not.toBeVisible();
});

test('add feed from empty state', async ({ page, user }) => {
  // Ensure we're on empty state (new user with no feeds)
  await expect(feedsPage.getEmptyStateHeading()).toBeVisible();

  // Click "Add Your First Feed" button
  await page.getByRole('button', { name: /add your first feed/i }).click();

  await expect(addFeedModal.getModal()).toBeVisible();
});
