import type { TagColor } from '@repo/domain/client';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TagBadge } from '~/components/TagBadge';

const meta: Meta<typeof TagBadge> = {
  title: 'Components/TagBadge',
  component: TagBadge,
  argTypes: {
    color: {
      control: 'select',
      options: [
        null,
        'red',
        'orange',
        'amber',
        'yellow',
        'lime',
        'green',
        'emerald',
        'teal',
        'cyan',
        'sky',
        'blue',
        'indigo',
        'violet',
        'purple',
        'fuchsia',
        'pink',
        'rose',
      ] satisfies (TagColor | null)[],
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md'],
    },
  },
  args: {
    name: 'Technology',
    color: 'blue',
    size: 'md',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoColor: Story = {
  args: { color: null },
};

export const Sizes: Story = {
  render: () => (
    <div class="flex items-center gap-3">
      <TagBadge name="Extra Small" color="rose" size="xs" />
      <TagBadge name="Small" color="green" size="sm" />
      <TagBadge name="Medium" color="blue" size="md" />
    </div>
  ),
};

export const AllColors: Story = {
  render: () => (
    <div class="flex flex-wrap gap-2">
      {(
        [
          'red',
          'orange',
          'amber',
          'yellow',
          'lime',
          'green',
          'emerald',
          'teal',
          'cyan',
          'sky',
          'blue',
          'indigo',
          'violet',
          'purple',
          'fuchsia',
          'pink',
          'rose',
        ] as TagColor[]
      ).map((color) => (
        <TagBadge name={color as string} color={color} size="sm" />
      ))}
    </div>
  ),
};
