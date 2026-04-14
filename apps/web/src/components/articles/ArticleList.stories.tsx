import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, within } from 'storybook/test';
import { ArticleList } from './ArticleList';
import { withRouter } from './articles-stories.decorator';
import {
  articleFixtures,
  articleTagFixtures,
  feedFixtures,
  tagFixtures,
  unreadArticles,
} from './articles-stories.fixtures';

const meta: Meta<typeof ArticleList> = {
  title: 'Articles/ArticleList',
  component: ArticleList,
  args: {
    feeds: feedFixtures,
    tags: tagFixtures,
    articleTags: articleTagFixtures,
    onUpdateArticle: fn().mockName('onUpdateArticle'),
    onLoadMore: fn().mockName('onLoadMore'),
    onAddTag: fn().mockName('onAddTag'),
    onRemoveTag: fn().mockName('onRemoveTag'),
  },
  decorators: [
    withRouter,
    (Story: () => any) => (
      <div class="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** List with multiple articles, more available to load */
export const WithArticles: Story = {
  args: {
    articles: articleFixtures.filter((a) => !a.isArchived),
    totalCount: 25,
    readStatus: 'all',
    context: 'inbox',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Load More/)).toBeInTheDocument();
  },
};

/** All articles shown — no "Load More" button */
export const AllLoaded: Story = {
  args: {
    articles: unreadArticles,
    totalCount: unreadArticles.length,
    readStatus: 'unread',
    context: 'inbox',
  },
};

/** Empty inbox — unread filter, shows "All Caught Up" */
export const EmptyUnread: Story = {
  args: {
    articles: [],
    totalCount: 0,
    readStatus: 'unread',
    context: 'inbox',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('All Caught Up!')).toBeInTheDocument();
  },
};

/** Empty feed — "all" filter */
export const EmptyFeed: Story = {
  args: {
    articles: [],
    totalCount: 0,
    readStatus: 'all',
    context: 'feed',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No Articles Found')).toBeInTheDocument();
  },
};

/** Empty tag — read filter */
export const EmptyTagRead: Story = {
  args: {
    articles: [],
    totalCount: 0,
    readStatus: 'read',
    context: 'tag',
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No Read Articles')).toBeInTheDocument();
  },
};
