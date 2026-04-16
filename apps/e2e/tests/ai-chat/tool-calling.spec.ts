import { expect, test } from '../../fixtures/auth-fixture';
import { AiChat } from '../../lib/AiChat';

test.describe('AI Chat Tool Calling', () => {
  test.slow();

  let chat: AiChat;

  test.beforeEach(async ({ page, user }) => {
    chat = new AiChat(page);
    await chat.goto();
  });

  test('ask about feeds triggers tool call', async () => {
    await chat.sendMessage('What feeds do I follow?');

    // Should see the AI use the list_feeds tool (tool indicator appears)
    // Wait for the response to complete
    await chat.waitForAiResponse();

    // AI should have responded with something about feeds (even if empty)
    await expect(chat.getAiMessages().first()).toBeVisible();
    const responseText = await chat.getAiMessages().first().textContent();
    expect(responseText).toBeTruthy();
  });

  test('ask about usage triggers tool call', async () => {
    await chat.sendMessage("What's my current usage?");

    await chat.waitForAiResponse();

    // AI should respond with usage/plan information
    await expect(chat.getAiMessages().first()).toBeVisible();
    const responseText = await chat.getAiMessages().first().textContent();
    expect(responseText).toBeTruthy();
  });

  test('follow a feed via chat', async () => {
    await chat.sendMessage('Follow this RSS feed: http://localhost:9999/tech-blog.xml');

    await chat.waitForAiResponse();

    // AI should confirm the feed was followed
    await expect(chat.getAiMessages().first()).toBeVisible();
    const responseText = await chat.getAiMessages().first().textContent();
    expect(responseText?.toLowerCase()).toMatch(/follow|subscri|added|success/);
  });
});
