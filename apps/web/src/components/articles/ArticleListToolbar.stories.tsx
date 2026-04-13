import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, within } from 'storybook/test';
import { ArticleListToolbar } from './ArticleListToolbar';
import { ReadStatusToggle } from './ReadStatusToggle';
import { withRouter } from './articles-stories.decorator';

const meta: Meta<typeof ArticleListToolbar> = {
  title: 'Articles/ArticleListToolbar',
  component: ArticleListToolbar,
  decorators: [withRouter],
};

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * NOTE: `leftContent` uses `<ReadStatusToggle>` which renders `<Link>`, so we
 * must use `render` instead of putting JSX in `args`. SolidJS evaluates JSX
 * eagerly — if placed in `args`, `<ReadStatusToggle>` would execute before
 * the `withRouter` decorator provides router context.
 */

/** Toolbar showing unread count */
export const UnreadFilter: Story = {
  render: () => (
    <ArticleListToolbar
      leftContent={<ReadStatusToggle currentStatus="unread" />}
      unreadCount={42}
      totalCount={100}
      readStatus="unread"
    />
  ),
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Unread')).toBeInTheDocument();
  },
};

/** Toolbar showing total count in "all" mode */
export const AllFilter: Story = {
  render: () => (
    <ArticleListToolbar
      leftContent={<ReadStatusToggle currentStatus="all" />}
      unreadCount={42}
      totalCount={100}
      readStatus="all"
    />
  ),
};

/** Toolbar with menu content */
export const WithMenu: Story = {
  render: () => (
    <ArticleListToolbar
      leftContent={<ReadStatusToggle currentStatus="unread" />}
      menuContent={
        <li>
          <button>Mark All Archived</button>
        </li>
      }
      unreadCount={10}
      readStatus="unread"
    />
  ),
};
