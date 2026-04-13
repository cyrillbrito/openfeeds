import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { MockChatProvider } from './chat-context.mock';
import { sessionFixtures } from './chat-stories.fixtures';
import { ConversationSwitcher } from './ConversationSwitcher';

const loadSession = fn().mockName('loadSession');
const deleteSession = fn().mockName('deleteSession');
const onClose = fn().mockName('onClose');

const meta: Meta = {
  title: 'Chat/ConversationSwitcher',
  component: ConversationSwitcher,
  args: {
    onClose,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Populated session list grouped by time period */
export const WithSessions: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider
        sessions={sessionFixtures}
        sessionId="session-1"
        onLoadSession={loadSession}
        onDeleteSession={deleteSession}
      >
        <div style={{ position: 'relative', 'min-height': '300px' }}>
          <Story />
        </div>
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    // Session titles render
    await expect(canvas.getByText('What feeds do I follow?')).toBeInTheDocument();
    await expect(canvas.getByText('Help me find AI newsletters')).toBeInTheDocument();
    // Time period group headers render
    await expect(canvas.getByText('Today')).toBeInTheDocument();
  },
};

/** Empty state — no conversations yet */
export const Empty: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider sessions={[]}>
        <div style={{ position: 'relative', 'min-height': '100px' }}>
          <Story />
        </div>
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No conversations yet')).toBeInTheDocument();
  },
};

/** Clicking a non-active session fires loadSession */
export const SelectSession: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider
        sessions={sessionFixtures}
        sessionId="session-1"
        onLoadSession={loadSession}
      >
        <div style={{ position: 'relative', 'min-height': '300px' }}>
          <Story />
        </div>
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    loadSession.mockClear();
    const canvas = within(canvasElement);
    // Click a different session
    const otherSession = canvas.getByText('Help me find AI newsletters');
    await userEvent.click(otherSession);
    await expect(loadSession).toHaveBeenCalledWith('session-3');
  },
};

/** Active session shows checkmark instead of delete button */
export const ActiveSession: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider sessions={sessionFixtures} sessionId="session-1">
        <div style={{ position: 'relative', 'min-height': '300px' }}>
          <Story />
        </div>
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const titleEl = canvas.getByText('What feeds do I follow?');
    await expect(titleEl.classList.contains('font-medium')).toBe(true);
  },
};
