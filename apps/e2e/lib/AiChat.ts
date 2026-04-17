import type { Locator, Page } from '@playwright/test';

export class AiChat {
  constructor(private page: Page) {}

  // ─── FAB ───

  getFab() {
    return this.page.getByTitle(/Open AI chat/);
  }

  // ─── Popover ───

  getPopover() {
    return this.page.getByRole('complementary', { name: 'AI Chat' });
  }

  /**
   * The popover uses opacity + pointer-events for show/hide instead of display:none.
   * Playwright considers opacity:0 as "visible", so we check the CSS class instead.
   */
  async isPopoverOpen() {
    const classes = await this.getPopover().getAttribute('class');
    return classes?.includes('opacity-100') ?? false;
  }

  getPopoverBackdrop() {
    return this.page.locator('.fixed.inset-0.bg-black\\/20');
  }

  getPopoverCloseButton() {
    return this.getPopover().getByTitle('Close');
  }

  getPopoverExpandButton() {
    return this.getPopover().getByTitle('Expand to full page');
  }

  getPopoverNewChatButton() {
    return this.getPopover().getByTitle('New chat');
  }

  // ─── Full Page ───

  getPageHeader() {
    return this.page.locator('header.sticky');
  }

  getPageNewChatButton() {
    return this.getPageHeader().getByTitle('New chat');
  }

  // ─── Input ───
  // Scoped: on full-page (/ai) there's no popover context, so use the page-level textarea.
  // When popover is open, both exist — callers should use getPopoverTextarea() if needed.

  getTextarea() {
    // Prefer the visible textarea (full-page or popover)
    return this.page.locator('textarea').first();
  }

  getPopoverTextarea() {
    return this.getPopover().locator('textarea');
  }

  getSendButton() {
    return this.page.getByTitle('Send').first();
  }

  getPopoverSendButton() {
    return this.getPopover().getByTitle('Send');
  }

  getStopButton() {
    return this.page.getByTitle('Stop generating').first();
  }

  // ─── Messages ───

  getEmptyState() {
    return this.page.getByText('How can I help?').first();
  }

  getPopoverEmptyState() {
    return this.getPopover().getByText('How can I help?');
  }

  /**
   * Scope for full-page chat — excludes the popover overlay which shares
   * the same ChatProvider and renders duplicate message elements.
   */
  private getPageContainer() {
    return this.page.getByTestId('chat-page');
  }

  getUserMessages() {
    return this.getPageContainer().locator('.bg-primary.text-primary-content');
  }

  getAiMessages() {
    return this.getPageContainer().locator('.prose.prose-chat');
  }

  getThinkingIndicator() {
    return this.page.getByText('Thinking...').first();
  }

  getErrorMessage() {
    return this.page.locator('.text-error\\/80').first();
  }

  getEmptyResponseWarning() {
    return this.page.getByText('Response was empty').first();
  }

  getToolCallIndicators() {
    return this.page.locator('.loading-spinner');
  }

  getPopoverAiMessages() {
    return this.getPopover().locator('.prose.prose-chat');
  }

  getPopoverUserMessages() {
    return this.getPopover().locator('.bg-primary.text-primary-content');
  }

  getToolCallDoneIndicators() {
    return this.page.locator('.text-success');
  }

  // ─── Conversation Switcher ───
  // The switcher toggle exists both in the popover title bar and the full-page header.
  // Use scoped variants when both are present.

  getSwitcherToggle() {
    return this.page.getByTitle('Switch conversation').first();
  }

  getPageSwitcherToggle() {
    return this.getPageHeader().getByTitle('Switch conversation');
  }

  getPopoverSwitcherToggle() {
    return this.getPopover().getByTitle('Switch conversation');
  }

  getSwitcherTitle() {
    return this.getSwitcherToggle().locator('span.truncate');
  }

  getPageSwitcherTitle() {
    return this.getPageSwitcherToggle().locator('span.truncate');
  }

  getSwitcherDropdown() {
    return this.page.locator('.absolute.top-full.min-w-72');
  }

  getSwitcherEmptyState() {
    return this.page.getByText('No conversations yet');
  }

  getSwitcherSession(title: string) {
    return this.getSwitcherDropdown().locator('button.group').filter({ hasText: title });
  }

  getSwitcherSessionDeleteButton(title: string) {
    return this.getSwitcherSession(title).getByTitle('Delete');
  }

  getSwitcherGroupHeader(label: string) {
    return this.getSwitcherDropdown().getByText(label);
  }

  // ─── Actions ───

  async openPopover() {
    // The FAB is at bottom-right, often overlapped by TanStack Devtools panel.
    // Use dispatchEvent to ensure the click reaches SolidJS's event handler.
    await this.getFab().dispatchEvent('click');
  }

  async closePopover() {
    await this.getPopoverCloseButton().dispatchEvent('click');
  }

  async expandToFullPage() {
    await this.getPopoverExpandButton().dispatchEvent('click');
  }

  async sendMessage(text: string) {
    const textarea = this.getTextarea();
    await textarea.fill(text);
    await this.getSendButton().click();
  }

  async sendPopoverMessage(text: string) {
    await this.getPopoverTextarea().fill(text);
    await this.getPopoverSendButton().dispatchEvent('click');
  }

  async openSwitcher() {
    await this.getSwitcherToggle().click();
  }

  async openPageSwitcher() {
    await this.getPageSwitcherToggle().click();
  }

  async switchToSession(title: string) {
    await this.getSwitcherSession(title).click();
  }

  async deleteSession(title: string) {
    await this.getSwitcherSession(title).hover();
    await this.getSwitcherSessionDeleteButton(title).click();
  }

  async waitForAiResponse() {
    // Wait for at least one AI prose message OR a completed tool call
    await this.getPageContainer()
      .locator('.prose.prose-chat, .text-success')
      .first()
      .waitFor({ timeout: 30_000 });
    // Then wait for streaming to finish (thinking indicator gone)
    await this.getThinkingIndicator().waitFor({ state: 'hidden', timeout: 30_000 });
  }

  async waitForPopoverAiResponse() {
    await this.getPopover()
      .locator('.prose.prose-chat, .text-success')
      .first()
      .waitFor({ timeout: 30_000 });
    await this.getThinkingIndicator().waitFor({ state: 'hidden', timeout: 30_000 });
  }

  async sendMessageAndWaitForResponse(text: string) {
    await this.sendMessage(text);
    await this.waitForAiResponse();
  }

  /**
   * Wait for the session to be persisted and synced via Electric.
   * The server saves sessions in a deferred `onFinish` callback, and Electric
   * must then sync the row back to the client collection. This polls the
   * switcher until at least one session appears.
   */
  async waitForSessionSync(timeout = 15_000) {
    await this.page
      .waitForFunction(
        (selector) => {
          const dropdown = document.querySelector(selector);
          if (!dropdown) return false;
          return dropdown.querySelectorAll('button.group').length > 0;
        },
        '.absolute.top-full.min-w-72',
        { timeout, polling: 500 },
      )
      .catch(() => {
        // If the dropdown isn't open, we can't poll it — noop
      });
  }

  async goto() {
    await this.page.goto('/ai');
  }

  async gotoSession(sessionId: string) {
    await this.page.goto(`/ai/${sessionId}`);
  }
}
