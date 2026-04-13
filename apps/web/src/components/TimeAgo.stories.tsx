import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TimeAgo } from '~/components/TimeAgo';

const meta: Meta<typeof TimeAgo> = {
  title: 'Components/TimeAgo',
  component: TimeAgo,
  args: {
    date: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FiveMinutesAgo: Story = {};

export const Yesterday: Story = {
  args: { date: new Date(Date.now() - 1000 * 60 * 60 * 24) },
};

export const LastWeek: Story = {
  args: { date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
};

export const TooltipBelow: Story = {
  args: { tooltipBottom: true },
};
