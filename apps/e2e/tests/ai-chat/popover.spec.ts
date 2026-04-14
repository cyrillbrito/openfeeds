import { expect, test } from '../../fixtures/auth-fixture';
import { AiChat } from '../../lib/AiChat';

test.describe('AI Chat Popover', () => {
  let chat: AiChat;

  test.beforeEach(async ({ page, user }) => {
    chat = new AiChat(page);
    await page.goto('/');
  });

  test('FAB is visible on authenticated pages', async () => {
    await expect(chat.getFab()).toBeVisible();
  });

  test('clicking FAB opens popover', async () => {
    await chat.openPopover();
    expect(await chat.isPopoverOpen()).toBe(true);
  });

  test('FAB is hidden while popover is open', async () => {
    await chat.openPopover();
    expect(await chat.isPopoverOpen()).toBe(true);
    // FAB is conditionally unmounted via <Show> — wait for SolidJS to remove it
    await expect(chat.getFab()).not.toBeAttached();
  });

  test('popover shows empty state', async () => {
    await chat.openPopover();
    await expect(chat.getPopoverEmptyState()).toBeVisible();
  });

  test('close button closes popover', async () => {
    await chat.openPopover();
    expect(await chat.isPopoverOpen()).toBe(true);

    await chat.closePopover();
    expect(await chat.isPopoverOpen()).toBe(false);
    await expect(chat.getFab()).toBeVisible();
  });

  test('backdrop click closes popover', async ({ page }) => {
    await chat.openPopover();
    expect(await chat.isPopoverOpen()).toBe(true);

    // Click the backdrop scrim via dispatchEvent
    await chat.getPopoverBackdrop().dispatchEvent('click');
    expect(await chat.isPopoverOpen()).toBe(false);
  });

  test('expand button navigates to /ai', async ({ page }) => {
    await chat.openPopover();
    await chat.expandToFullPage();

    await expect(page).toHaveURL('/ai');
    expect(await chat.isPopoverOpen()).toBe(false);
  });

  test('Cmd+J toggles popover', async ({ page }) => {
    // Wait for FAB to be visible — ensures the frame component has mounted
    // and the keyboard shortcut handler is registered
    await expect(chat.getFab()).toBeVisible();

    // Dispatch keydown event directly on document to avoid focus/interception issues
    const pressShortcut = () =>
      page.evaluate(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'j', metaKey: true, bubbles: true }),
        );
      });

    await pressShortcut();
    await page.waitForTimeout(300);
    expect(await chat.isPopoverOpen()).toBe(true);

    await pressShortcut();
    await page.waitForTimeout(300);
    expect(await chat.isPopoverOpen()).toBe(false);
  });
});
