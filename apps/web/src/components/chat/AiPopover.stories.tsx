import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, within } from 'storybook/test';
import { AiPopover } from './AiPopover';
import { MockChatProvider } from './chat-context.mock';
import { conversation, sessionFixtures } from './chat-stories.fixtures';

const startNewChat = fn().mockName('startNewChat');

const meta: Meta = {
  title: 'Chat/AiPopover',
  component: AiPopover,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Open popover with conversation */
export const OpenWithConversation: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider
        messages={conversation}
        currentTitle="What feeds do I follow?"
        sessions={sessionFixtures}
        onStartNewChat={startNewChat}
      >
        <Story />
      </MockChatProvider>
    ),
  ],
  args: {
    open: true,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    // Title bar renders
    await expect(canvas.getByText('What feeds do I follow?')).toBeInTheDocument();
    // Action buttons
    await expect(canvas.getByTitle('New chat')).toBeInTheDocument();
    await expect(canvas.getByTitle('Expand to full page')).toBeInTheDocument();
    await expect(canvas.getByTitle('Close')).toBeInTheDocument();
    // Messages render
    await expect(canvas.getByText('Unfollow The Verge')).toBeInTheDocument();
    // ARIA role
    const panel = canvasElement.querySelector('[role="complementary"]');
    await expect(panel).not.toBeNull();
    await expect(panel?.getAttribute('aria-label')).toBe('AI Chat');
  },
};

/** Open popover in empty / new chat state */
export const OpenEmpty: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider sessions={[]}>
        <Story />
      </MockChatProvider>
    ),
  ],
  args: {
    open: true,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('How can I help?')).toBeInTheDocument();
    await expect(canvas.getByPlaceholderText('Ask me anything...')).toBeInTheDocument();
  },
};

/** Closed popover — not visible */
export const Closed: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider>
        <Story />
      </MockChatProvider>
    ),
  ],
  args: {
    open: false,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    // The panel should have pointer-events-none when closed
    const panel = canvasElement.querySelector('[role="complementary"]');
    await expect(panel).not.toBeNull();
    await expect(panel?.classList.contains('pointer-events-none')).toBe(true);
  },
};
