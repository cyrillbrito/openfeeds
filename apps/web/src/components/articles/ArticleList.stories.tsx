import type { ComponentType } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { ArticleList } from './ArticleList';
import { MockArticleListProvider, type ArticleListContextValue } from './ArticleListContext.shared';
import { withRouter } from './articles-stories.decorator';
import {
  articleFixtures,
  feedFixtures,
  tagFixtures,
  unreadArticles,
} from './articles-stories.fixtures';

function createMockCtx(overrides?: Partial<ArticleListContextValue>): ArticleListContextValue {
  return {
    articles: articleFixtures.filter((a) => !a.isArchived),
    totalCount: 25,
    unreadCount: 10,
    archivableCount: 5,
    feeds: feedFixtures,
    tags: tagFixtures,
    shortsExist: false,
    readStatus: 'all',
    context: 'inbox',
    loadMore: fn().mockName('loadMore'),
    updateArticle: fn().mockName('updateArticle'),
    markAllArchived: fn().mockName('markAllArchived') as any,
    addTag: fn().mockName('addTag'),
    removeTag: fn().mockName('removeTag'),
    ...overrides,
  };
}

const meta: Meta<typeof ArticleList> = {
  title: 'Articles/ArticleList',
  component: ArticleList,
  decorators: [
    withRouter,
    (Story: ComponentType) => (
      <MockArticleListProvider value={createMockCtx()}>
        <div className="w-full max-w-2xl">
          <Story />
        </div>
      </MockArticleListProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj;

/** List with multiple articles, more available to load */
export const WithArticles: Story = {
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Load More/)).toBeInTheDocument();
  },
};

/** All articles shown — no "Load More" button */
export const AllLoaded: Story = {
  decorators: [
    withRouter,
    (Story: ComponentType) => (
      <MockArticleListProvider
        value={createMockCtx({
          articles: unreadArticles,
          totalCount: unreadArticles.length,
          readStatus: 'unread',
        })}
      >
        <div className="w-full max-w-2xl">
          <Story />
        </div>
      </MockArticleListProvider>
    ),
  ],
};

/** Empty inbox — unread filter, shows "All Caught Up" */
export const EmptyUnread: Story = {
  decorators: [
    withRouter,
    (Story: ComponentType) => (
      <MockArticleListProvider
        value={createMockCtx({
          articles: [],
          totalCount: 0,
          readStatus: 'unread',
          context: 'inbox',
        })}
      >
        <div className="w-full max-w-2xl">
          <Story />
        </div>
      </MockArticleListProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('All Caught Up!')).toBeInTheDocument();
  },
};

/** Empty feed — "all" filter */
export const EmptyFeed: Story = {
  decorators: [
    withRouter,
    (Story: ComponentType) => (
      <MockArticleListProvider
        value={createMockCtx({
          articles: [],
          totalCount: 0,
          readStatus: 'all',
          context: 'feed',
        })}
      >
        <div className="w-full max-w-2xl">
          <Story />
        </div>
      </MockArticleListProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No Articles Found')).toBeInTheDocument();
  },
};

/** Empty tag — read filter */
export const EmptyTagRead: Story = {
  decorators: [
    withRouter,
    (Story: ComponentType) => (
      <MockArticleListProvider
        value={createMockCtx({
          articles: [],
          totalCount: 0,
          readStatus: 'read',
          context: 'tag',
        })}
      >
        <div className="w-full max-w-2xl">
          <Story />
        </div>
      </MockArticleListProvider>
    ),
  ],
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No Read Articles')).toBeInTheDocument();
  },
};
