import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MockChatProvider } from './chat-context.mock';
import { sessionFixtures } from './chat-stories.fixtures';
import { ChatTitleSwitcher } from './ChatTitleSwitcher';

const meta: Meta = {
  title: 'Chat/ChatTitleSwitcher',
  component: ChatTitleSwitcher,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default collapsed state showing title + chevron */
export const Default: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider currentTitle="What feeds do I follow?" sessions={sessionFixtures}>
        <div style={{ position: 'relative', 'min-height': '300px' }}>
          <Story />
        </div>
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('What feeds do I follow?')).toBeInTheDocument();
    await expect(canvas.getByTitle('Switch conversation')).toBeInTheDocument();
  },
};

/** Small variant used in popover */
export const SmallSize: Story = {
  args: { size: 'sm' },
  decorators: [
    (Story: () => any) => (
      <MockChatProvider currentTitle="Short title" sessions={sessionFixtures}>
        <div style={{ position: 'relative', 'min-height': '300px' }}>
          <Story />
        </div>
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const title = canvas.getByText('Short title');
    await expect(title).toBeInTheDocument();
    // sm variant applies max-w-48 and text-sm
    await expect(title.classList.contains('text-sm')).toBe(true);
  },
};

/** Clicking the title opens the ConversationSwitcher dropdown */
export const OpenDropdown: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider currentTitle="New chat" sessions={sessionFixtures}>
        <div style={{ position: 'relative', 'min-height': '350px' }}>
          <Story />
        </div>
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    // Click to open dropdown
    const btn = canvas.getByTitle('Switch conversation');
    await userEvent.click(btn);
    // Conversation list should appear
    await expect(canvas.getByText('What feeds do I follow?')).toBeInTheDocument();
    await expect(canvas.getByText('Help me find AI newsletters')).toBeInTheDocument();
  },
};
