import { expect, test } from '../../fixtures/auth-fixture';
import { AiChat } from '../../lib/AiChat';

test.describe('AI Chat Sessions', () => {
  test.setTimeout(60_000);

  let chat: AiChat;

  test.beforeEach(async ({ page, user }) => {
    chat = new AiChat(page);
    await chat.goto();
  });

  test('session persists after reload', async ({ page }) => {
    await chat.sendMessageAndWaitForResponse('Say hello');

    // Wait for server-side persistence + Electric sync before checking
    await chat.openSwitcher();
    await chat.waitForSessionSync();

    // At least one session should exist (not empty state)
    await expect(chat.getSwitcherEmptyState()).not.toBeVisible({ timeout: 10_000 });
    const sessionButton = chat.getSwitcherDropdown().locator('button.group').first();
    await expect(sessionButton).toBeVisible();

    // Close switcher, reload, and verify it persists across reload
    await chat.openSwitcher();
    await page.reload();
    await expect(chat.getTextarea()).toBeVisible();

    await chat.openSwitcher();
    await expect(chat.getSwitcherEmptyState()).not.toBeVisible({ timeout: 10_000 });
    await expect(chat.getSwitcherDropdown().locator('button.group').first()).toBeVisible();
  });

  test('session title derived from first message', async () => {
    await chat.sendMessageAndWaitForResponse('What feeds do I have?');

    await chat.openSwitcher();
    await chat.waitForSessionSync();

    // Session title should contain the first message text (possibly truncated)
    const sessionButton = chat.getSwitcherDropdown().locator('button.group').first();
    await expect(sessionButton).toBeVisible();
    await expect(sessionButton).toContainText('What feeds do I have?');
  });

  test('can switch between sessions', async () => {
    // Create first session
    await chat.sendMessageAndWaitForResponse('Say the word apple');

    // Wait for first session to sync before creating a second
    await chat.openSwitcher();
    await chat.waitForSessionSync();
    await chat.openSwitcher(); // close

    // Start new chat and create second session
    await chat.getPageNewChatButton().click();
    await expect(chat.getEmptyState()).toBeVisible();
    await chat.sendMessageAndWaitForResponse('Say the word banana');

    // Open switcher and wait for both sessions
    await chat.openSwitcher();
    await chat.waitForSessionSync();

    // There should be at least 2 sessions
    const sessions = chat.getSwitcherDropdown().locator('button.group');
    expect(await sessions.count()).toBeGreaterThanOrEqual(2);

    // Click the session containing "apple"
    await chat.getSwitcherSession('apple').click();

    // Messages should show the first conversation
    await expect(chat.getUserMessages().first()).toContainText('apple', { timeout: 10_000 });
  });

  test('can delete a session', async () => {
    await chat.sendMessageAndWaitForResponse('Say hello for delete test');

    await chat.openSwitcher();
    await chat.waitForSessionSync();

    const sessionButton = chat.getSwitcherDropdown().locator('button.group').first();
    await expect(sessionButton).toBeVisible();
    const sessionTitle = await sessionButton.locator('p.truncate').textContent();

    // Hover and click delete
    await sessionButton.hover();
    await sessionButton.getByTitle('Delete').click();

    // Session should be removed — switcher may show empty state or fewer sessions
    if (sessionTitle) {
      await expect(chat.getSwitcherSession(sessionTitle)).not.toBeVisible();
    }
  });

  test('deleting active session starts new chat', async () => {
    await chat.sendMessageAndWaitForResponse('Say hello for active delete test');

    await chat.openSwitcher();
    await chat.waitForSessionSync();

    // Delete the current (active) session
    const sessionButton = chat.getSwitcherDropdown().locator('button.group').first();
    await expect(sessionButton).toBeVisible();
    await sessionButton.hover();
    await sessionButton.getByTitle('Delete').click();

    // Should reset to new chat
    await expect(chat.getEmptyState()).toBeVisible({ timeout: 5_000 });
    await expect(chat.getSwitcherTitle()).toHaveText('New chat');
  });

  test('expand from popover preserves session', async ({ page }) => {
    // Start from a non-/ai page so popover is available
    await page.goto('/');
    await chat.openPopover();
    await chat.sendPopoverMessage('Say hello for expand test');
    await chat.waitForAiResponse();

    // Expand to full page
    await chat.expandToFullPage();

    // URL should be /ai/some-session-id
    await expect(page).toHaveURL(/\/ai\/.+/);

    // Messages should be preserved
    await expect(chat.getUserMessages().first()).toContainText('expand test');
  });

  test('switching session mid-stream preserves messages', async ({ page }) => {
    // BUG REPRO: send a message, switch away before the AI response finishes,
    // wait for the stream to complete in the background, then switch back.
    // Expected: both user message and AI response are visible.
    // Actual bug: the session never appears in the switcher / messages are missing.
    test.fail();

    // Step 1: Send a message that elicits a longer response
    await chat.sendMessage('Write a detailed paragraph about the history of RSS feeds');

    // Step 2: Wait for streaming to start (user bubble visible)
    await expect(chat.getUserMessages().first()).toBeVisible({ timeout: 10_000 });

    // Step 3: Switch away while stream is still running
    await chat.getPageNewChatButton().click();
    await expect(chat.getEmptyState()).toBeVisible({ timeout: 5_000 });

    // Step 4: Wait for the background stream to finish + Electric sync.
    // Also reload to ensure we're reading from persisted state, not memory.
    await page.waitForTimeout(20_000);
    await page.reload();
    await expect(chat.getTextarea()).toBeVisible({ timeout: 10_000 });

    // Step 5: Open switcher — the original session should appear
    await chat.openPageSwitcher();
    await chat.waitForSessionSync();

    const sessions = chat.getSwitcherDropdown().locator('button.group');
    const sessionCount = await sessions.count();

    // BUG CHECK: If session count is 0, the session was lost entirely
    expect(
      sessionCount,
      'Session from mid-stream switch should be persisted',
    ).toBeGreaterThanOrEqual(1);

    // Click the first (and likely only) session
    await sessions.first().click();
    await page.waitForTimeout(2_000);

    // Verify the user message is there
    await expect(chat.getUserMessages().first()).toContainText('RSS', { timeout: 10_000 });

    // Verify the AI response is also there
    await expect(chat.getAiMessages().first()).toBeVisible({ timeout: 10_000 });
  });

  test('conversation switcher shows "No conversations yet" for fresh user', async () => {
    await chat.openSwitcher();
    await expect(chat.getSwitcherEmptyState()).toBeVisible();
  });
});
