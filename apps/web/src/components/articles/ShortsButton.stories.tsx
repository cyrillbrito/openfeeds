import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, within } from 'storybook/test';
import { withRouter } from './articles-stories.decorator';
import { ShortsButton } from './ShortsButton';

const meta: Meta<typeof ShortsButton> = {
  title: 'Articles/ShortsButton',
  component: ShortsButton,
  decorators: [withRouter],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Button visible when shorts exist */
export const Visible: Story = {
  args: {
    shortsExist: true,
    linkProps: { to: '/inbox/shorts' },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Shorts')).toBeInTheDocument();
  },
};

/** Button hidden when no shorts */
export const Hidden: Story = {
  args: {
    shortsExist: false,
    linkProps: { to: '/inbox/shorts' },
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByText('Shorts')).not.toBeInTheDocument();
  },
};
