import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, within } from 'storybook/test';
import { AiFab } from './AiFab';

const meta: Meta = {
  title: 'Chat/AiFab',
  component: AiFab,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default FAB with sparkles icon */
export const Default: Story = {
  args: {
    onClick: () => console.log('[Story] FAB clicked'),
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    const btn = canvas.getByTitle(/Open AI chat/);
    await expect(btn).toBeInTheDocument();
    const title = btn.getAttribute('title') ?? '';
    await expect(title).toMatch(/[⌘Ctrl]\+?J/);
  },
};
