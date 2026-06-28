import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ComponentType } from 'react';
import { expect, within } from 'storybook/test';
import { MockChatProvider } from './chat-context.mock';
import {
  aiMessage,
  conversation,
  emptyAssistantMessage,
  toolCallMessage,
  userMessage,
} from './chat-stories.fixtures';
import { ChatMessages } from './ChatMessages';

const meta: Meta = {
  title: 'Chat/ChatMessages',
  component: ChatMessages,
};

export default meta;
type Story = StoryObj;

/** Empty chat — "How can I help?" prompt */
export const EmptyState: Story = {
  decorators: [
    (Story: ComponentType) => (
      <MockChatProvider>
        <div style={{ minHeight: '300px', display: 'flex', flexDirection: 'column' }}>
          <Story />
        </div>
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('How can I help?')).toBeInTheDocument();
  },
};

/** Multi-turn conversation with markdown table */
export const Conversation: Story = {
  decorators: [
    (Story: ComponentType) => (
      <MockChatProvider messages={conversation}>
        <Story />
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('What feeds do I follow?')).toBeInTheDocument();
    const tables = canvasElement.querySelectorAll('table');
    await expect(tables.length).toBeGreaterThan(0);
  },
};

/** Tool call indicator with checkmark */
export const ToolCall: Story = {
  decorators: [
    (Story: ComponentType) => (
      <MockChatProvider messages={[userMessage, toolCallMessage]}>
        <Story />
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('list feeds')).toBeInTheDocument();
    await expect(canvas.getByText('✓')).toBeInTheDocument();
  },
};

/** Error state — rate limit */
export const ErrorState: Story = {
  decorators: [
    (Story: ComponentType) => (
      <MockChatProvider messages={[userMessage]} error={new Error('429 Rate limited')}>
        <Story />
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText('Rate limited — too many requests. Try again in a moment.'),
    ).toBeInTheDocument();
  },
};

/** Loading state — "Thinking..." spinner */
export const Loading: Story = {
  decorators: [
    (Story: ComponentType) => (
      <MockChatProvider messages={[userMessage, aiMessage]} isLoading>
        <Story />
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Thinking...')).toBeInTheDocument();
  },
};

/** Empty assistant response — amber warning */
export const EmptyResponse: Story = {
  decorators: [
    (Story: ComponentType) => (
      <MockChatProvider messages={[userMessage, emptyAssistantMessage]}>
        <Story />
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Response was empty/)).toBeInTheDocument();
  },
};
