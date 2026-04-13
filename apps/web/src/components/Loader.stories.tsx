import type { Meta, StoryObj } from 'storybook-solidjs';
import { Loader, CenterLoader } from '~/components/Loader';

const meta: Meta = {
  title: 'Components/Loader',
  component: Loader,
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Spinner: Story = {};

export const Centered: Story = {
  render: () => <CenterLoader />,
};
