import { expect, test } from '../../fixtures/auth-fixture';
import { AiChat } from '../../lib/AiChat';
import { Drawer } from '../../lib/Drawer';

test.describe('AI Chat Full Page', () => {
  let chat: AiChat;

  test.beforeEach(async ({ page, user }) => {
    chat = new AiChat(page);
  });

  test('/ai renders full-page chat', async ({ page }) => {
    await chat.goto();

    await expect(page).toHaveURL('/ai');
    await expect(chat.getPageHeader()).toBeVisible();
    await expect(chat.getTextarea()).toBeVisible();
    await expect(chat.getEmptyState()).toBeVisible();
  });

  test('FAB is hidden on /ai route', async () => {
    await chat.goto();
    await expect(chat.getFab()).not.toBeVisible();
  });

  test('sidebar AI Chat link navigates to /ai', async ({ page }) => {
    await page.goto('/');
    const drawer = new Drawer(page);

    await page.getByRole('link', { name: 'AI Chat' }).click();
    await expect(page).toHaveURL('/ai');
  });

  test('new chat button visible in header', async () => {
    await chat.goto();
    await expect(chat.getPageNewChatButton()).toBeVisible();
  });

  test('conversation switcher shows empty state', async () => {
    await chat.goto();
    await chat.openPageSwitcher();

    await expect(chat.getSwitcherEmptyState()).toBeVisible();
  });
});
