import { expect, test } from '../../fixtures/auth-fixture';
import { AiChat } from '../../lib/AiChat';

test.describe('AI Chat Full Page', () => {
  // Anthropic key is unavailable on forked PRs (secrets aren't passed through).
  // The `/api/chat` route returns 503 without it, so every assertion would fail.
  test.skip(!process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY not configured');
  test.slow();
  let chat: AiChat;

  test.beforeEach(async ({ page, user }) => {
    chat = new AiChat(page);
  });

  test('/ai renders full-page chat', async ({ page }) => {
    await chat.goto();

    await expect(page).toHaveURL('/ai');
    await expect(chat.getPageHeader()).toBeVisible({ timeout: 15_000 });
    await expect(chat.getTextarea()).toBeVisible();
    await expect(chat.getEmptyState()).toBeVisible();
  });

  test('FAB is hidden on /ai route', async () => {
    await chat.goto();
    await expect(chat.getFab()).not.toBeVisible();
  });

  test('sidebar AI Chat link navigates to /ai', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'AI Chat' }).click();
    await expect(page).toHaveURL('/ai');
  });
});
