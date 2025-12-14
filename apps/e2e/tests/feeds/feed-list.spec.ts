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

test('display empty state when no feeds', async ({ page, user }) => {
  // New user should see empty state
  await expect(feedsPage.getEmptyStateHeading()).toBeVisible();
  await expect(page.getByText(/start building your personalized news feed/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /add your first feed/i })).toBeVisible();
});

test('display feed list with feeds', async ({ page, user }) => {
  const drawer = new Drawer(page);
  // Add a feed for this test
  const feedUrl = `${MOCK_SERVER_URL}/tech-blog.xml`;
  await feedsPage.openAddFeedModal();
  await addFeedModal.addFeedByUrl(feedUrl);
  await expect(feedsPage.getFeedCards().first()).toBeVisible({ timeout: 10000 });

  // Verify feed list displays
  await expect(feedsPage.getFeedCards().first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /manage feeds/i })).toBeVisible();

  await expect(page).toHaveScreenshot('feed-list-display.png', {
    mask: [drawer.getUserEmail()],
  });
});

test('search feeds by title', async ({ page, user }) => {
  // Add a feed for this test
  const feedUrl = `${MOCK_SERVER_URL}/tech-blog.xml`;
  await feedsPage.openAddFeedModal();
  await addFeedModal.addFeedByUrl(feedUrl);
  await expect(feedsPage.getFeedCards().first()).toBeVisible({ timeout: 10000 });

  // Get the first feed's title
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedTitle = await firstFeedCard.getByRole('heading').first().textContent();

  // Search for the feed
  await feedsPage.getSearchInput().fill(feedTitle!.trim());
  await page.waitForTimeout(300); // Wait for debounce

  // Feed should still be visible
  await expect(firstFeedCard).toBeVisible();
});

test('search with no results', async ({ page, user }) => {
  // Add a feed for this test
  const feedUrl = `${MOCK_SERVER_URL}/tech-blog.xml`;
  await feedsPage.openAddFeedModal();
  await addFeedModal.addFeedByUrl(feedUrl);
  await expect(feedsPage.getFeedCards().first()).toBeVisible({ timeout: 10000 });

  // Search for something that doesn't exist
  await feedsPage.getSearchInput().fill('nonexistent-feed-xyz-123');
  await page.waitForTimeout(300); // Wait for debounce

  // Should show no results message
  await expect(page.getByText(/no feeds found/i)).toBeVisible();
});

test('clear search', async ({ page, user }) => {
  // Add a feed for this test
  const feedUrl = `${MOCK_SERVER_URL}/tech-blog.xml`;
  await feedsPage.openAddFeedModal();
  await addFeedModal.addFeedByUrl(feedUrl);
  await expect(feedsPage.getFeedCards().first()).toBeVisible({ timeout: 10000 });

  // Search for something
  await feedsPage.getSearchInput().fill('test-search');
  await page.waitForTimeout(300);

  // Clear search
  const clearButton = page.getByRole('button', { name: /clear search/i });
  if (await clearButton.isVisible().catch(() => false)) {
    await clearButton.click();
    await page.waitForTimeout(300);

    // Feed should be visible again
    await expect(feedsPage.getFeedCards().first()).toBeVisible();
  }
});

test('navigate to feed detail from feed card', async ({ page, user }) => {
  // Add a feed for this test
  const feedUrl = `${MOCK_SERVER_URL}/tech-blog.xml`;
  await feedsPage.openAddFeedModal();
  await addFeedModal.addFeedByUrl(feedUrl);
  await expect(feedsPage.getFeedCards().first()).toBeVisible({ timeout: 10000 });

  // Click on feed title
  const firstFeedCard = feedsPage.getFirstFeedCard();
  const feedLink = firstFeedCard.getByRole('link').first();
  await feedLink.click();

  // Should navigate to feed detail page
  await expect(page).toHaveURL(/\/feeds\/\d+/);
});
