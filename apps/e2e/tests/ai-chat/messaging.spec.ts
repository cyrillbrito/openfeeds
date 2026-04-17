import { expect, test } from '../../fixtures/auth-fixture';
import { AiChat } from '../../lib/AiChat';

test.describe('AI Chat Messaging', () => {
  test.skip(!process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY not set');
  test.setTimeout(90_000);

  let chat: AiChat;

  test.beforeEach(async ({ page, user }) => {
    chat = new AiChat(page);
    await chat.goto();
  });

  test('send message and receive response', async () => {
    await chat.sendMessage('Say hello in one word');

    // User message appears immediately
    await expect(chat.getUserMessages().first()).toBeVisible();
    await expect(chat.getUserMessages().first()).toContainText('Say hello in one word');

    // Wait for AI response
    await chat.waitForAiResponse();
    await expect(chat.getAiMessages().first()).toBeVisible();
  });

  test('input clears and disables during generation', async ({ page }) => {
    await chat.getTextarea().fill('Say hello');
    await chat.getSendButton().click();

    // Input should clear and become disabled
    await expect(chat.getTextarea()).toHaveValue('');
    await expect(chat.getTextarea()).toBeDisabled();
    await expect(chat.getTextarea()).toHaveAttribute('placeholder', 'Generating response...');

    // Wait for completion — input re-enables
    await chat.waitForAiResponse();
    await expect(chat.getTextarea()).toBeEnabled();
    await expect(chat.getTextarea()).toHaveAttribute('placeholder', 'Ask me anything...');
  });

  test('stop button visible during generation', async () => {
    await chat.sendMessage('Write a long essay about the history of RSS feeds');

    // Stop button should appear while streaming
    await expect(chat.getStopButton()).toBeVisible({ timeout: 10_000 });

    // Click stop
    await chat.getStopButton().click();

    // Stop button should disappear, input re-enables
    await expect(chat.getStopButton()).not.toBeVisible();
    await expect(chat.getTextarea()).toBeEnabled();
  });

  test('error state on server failure', async ({ page }) => {
    // Intercept the chat endpoint to return 500
    await page.route('**/api/chat', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      }),
    );

    await chat.sendMessage('This should fail');

    // Error message should appear
    await expect(chat.getErrorMessage()).toBeVisible({ timeout: 10_000 });
  });

  test('multiple messages in sequence', async () => {
    // Start a fresh session to avoid picking up messages from prior tests
    await chat.getPageNewChatButton().click();
    await expect(chat.getEmptyState()).toBeVisible();

    await chat.sendMessageAndWaitForResponse('Say the number 1');
    await chat.sendMessageAndWaitForResponse('Say the number 2');

    // Both user messages visible
    await expect(chat.getUserMessages()).toHaveCount(2);
    // Both AI responses visible
    await expect(chat.getAiMessages().first()).toBeVisible();
    expect(await chat.getAiMessages().count()).toBeGreaterThanOrEqual(2);
  });

  test('sending a message updates the title', async () => {
    // Initially "New chat"
    await expect(chat.getSwitcherTitle()).toHaveText('New chat');

    await chat.sendMessageAndWaitForResponse('What feeds do I have?');

    // Title should update to reflect the first message
    await expect(chat.getSwitcherTitle()).not.toHaveText('New chat');
  });
});
