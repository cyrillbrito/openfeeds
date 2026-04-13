import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, within } from 'storybook/test';
import { MarkAllArchivedButton } from './MarkAllArchivedButton';

const meta: Meta<typeof MarkAllArchivedButton> = {
  title: 'Articles/MarkAllArchivedButton',
  component: MarkAllArchivedButton,
  decorators: [
    (Story: () => any) => (
      <ul class="menu">
        <li>
          <Story />
        </li>
      </ul>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default state with article count */
export const Default: Story = {
  args: {
    totalCount: 42,
    contextLabel: 'globally',
    onConfirm: fn().mockName('onConfirm'),
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Mark All Archived')).toBeInTheDocument();
  },
};

/** In feed context */
export const FeedContext: Story = {
  args: {
    totalCount: 15,
    contextLabel: 'in this feed',
    onConfirm: fn().mockName('onConfirm'),
  },
};

/** Disabled state */
export const Disabled: Story = {
  args: {
    totalCount: 0,
    disabled: true,
    onConfirm: fn().mockName('onConfirm'),
  },
};
