import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { MockChatProvider } from './chat-context.mock';
import { ChatInput } from './ChatInput';

const sendMessage = fn().mockName('sendMessage');
const stop = fn().mockName('stop');

const meta: Meta = {
  title: 'Chat/ChatInput',
  component: ChatInput,
  decorators: [
    (Story: () => any) => (
      <MockChatProvider onSendMessage={sendMessage} onStop={stop}>
        <Story />
      </MockChatProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default idle state — empty textarea, no buttons */
export const Default: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Ask me anything...');
    await expect(textarea).toBeInTheDocument();
    await expect(textarea).not.toBeDisabled();
    // No send or stop button when empty
    const sendBtn = canvasElement.querySelector('[title="Send"]');
    await expect(sendBtn).toBeNull();
    const stopBtn = canvasElement.querySelector('[title="Stop generating"]');
    await expect(stopBtn).toBeNull();
  },
};

/** Loading state — textarea stays enabled for typing, stop button visible, clicking stop fires action */
export const Loading: Story = {
  decorators: [
    (Story: () => any) => (
      <MockChatProvider isLoading onStop={stop}>
        <Story />
      </MockChatProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Generating response...');
    // Textarea should remain enabled so users can type their next message
    await expect(textarea).not.toBeDisabled();
    // User can type while loading
    await userEvent.type(textarea, 'Next question');
    await expect(textarea).toHaveValue('Next question');
    // Send button should NOT appear while loading
    const sendBtn = canvasElement.querySelector('[title="Send"]');
    await expect(sendBtn).toBeNull();
    // Stop button should be visible and functional
    const stopBtn = canvasElement.querySelector('[title="Stop generating"]') as HTMLElement;
    await expect(stopBtn).not.toBeNull();
    await userEvent.click(stopBtn);
    await expect(stop).toHaveBeenCalled();
  },
};

/** Typing text makes the send button appear */
export const WithText: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Ask me anything...');
    await userEvent.type(textarea, 'Hello AI');
    const sendBtn = canvasElement.querySelector('[title="Send"]');
    await expect(sendBtn).not.toBeNull();
  },
};

/** Submitting fires sendMessage with the input text */
export const Submit: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    sendMessage.mockClear();
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Ask me anything...');
    await userEvent.type(textarea, 'Hello AI');
    const sendBtn = canvasElement.querySelector('[title="Send"]') as HTMLElement;
    await userEvent.click(sendBtn);
    await expect(sendMessage).toHaveBeenCalledWith('Hello AI');
  },
};

/** Multiline text — textarea grows to fit content, capped at max height */
export const Multiline: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByPlaceholderText('Ask me anything...');
    const initialHeight = textarea.offsetHeight;

    // Type several lines using Shift+Enter for newlines
    const lines = Array.from(
      { length: 6 },
      (_, i) =>
        `Line ${i + 1}: This is a longer sentence to test how the textarea handles wrapping and multiline input.`,
    ).join('\n');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, lines.replaceAll('\n', '{Shift>}{Enter}{/Shift}'));

    // Textarea should have grown
    await expect(textarea.offsetHeight).toBeGreaterThan(initialHeight);
    // But not beyond max-h-40 (160px)
    await expect(textarea.offsetHeight).toBeLessThanOrEqual(160);
    // Send button should be visible
    const sendBtn = canvasElement.querySelector('[title="Send"]');
    await expect(sendBtn).not.toBeNull();
  },
};
