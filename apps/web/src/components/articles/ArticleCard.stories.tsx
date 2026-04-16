import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, within } from 'storybook/test';
import { ArticleCard } from './ArticleCard';
import { MockArticleListProvider, type ArticleListContextValue } from './ArticleListContext.shared';
import { withRouter } from './articles-stories.decorator';
import {
  articleTagFixtures,
  feedFixtures,
  htmlDescriptionArticle,
  noFeedArticle,
  readArticle,
  tagFixtures,
  unreadArticle,
  youtubeArticle,
} from './articles-stories.fixtures';

const createFixtureTagsAccessor = (articleId: string) => () =>
  articleTagFixtures.filter((at) => at.articleId === articleId);

function createMockCtx(overrides?: Partial<ArticleListContextValue>): ArticleListContextValue {
  return {
    articles: () => [],
    totalCount: () => 0,
    unreadCount: () => 0,
    archivableCount: () => 0,
    feeds: () => feedFixtures,
    tags: () => tagFixtures,
    shortsExist: () => false,
    readStatus: () => 'all',
    context: 'inbox',
    loadMore: fn().mockName('loadMore'),
    updateArticle: fn().mockName('updateArticle'),
    markAllArchived: fn().mockName('markAllArchived') as any,
    addTag: fn().mockName('addTag'),
    removeTag: fn().mockName('removeTag'),
    createArticleTagsAccessor: createFixtureTagsAccessor,
    ...overrides,
  };
}

const meta: Meta<typeof ArticleCard> = {
  title: 'Articles/ArticleCard',
  component: ArticleCard,
  decorators: [
    withRouter,
    (Story: () => any) => (
      <MockArticleListProvider value={createMockCtx()}>
        <div class="divide-base-300 w-full max-w-2xl divide-y">
          <Story />
        </div>
      </MockArticleListProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Unread article with tags */
export const Unread: Story = {
  args: { article: unreadArticle },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(unreadArticle.title)).toBeInTheDocument();
    await expect(canvas.getByText('TechCrunch')).toBeInTheDocument();
    await expect(canvas.getByText('Mark read')).toBeInTheDocument();
  },
};

/** Read article — reduced opacity */
export const Read: Story = {
  args: { article: readArticle },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Read')).toBeInTheDocument();
  },
};

/** Article with HTML description */
export const HtmlDescription: Story = {
  args: { article: htmlDescriptionArticle },
};

/** YouTube Shorts article — shows thumbnail */
export const YouTubeShort: Story = {
  args: { article: youtubeArticle },
};

/** Article without a feed (saved article) */
export const NoFeed: Story = {
  args: { article: noFeedArticle },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Saved Article')).toBeInTheDocument();
  },
};

/** Article with no tags at all */
export const NoTags: Story = {
  args: { article: unreadArticle },
  decorators: [
    withRouter,
    (Story: () => any) => (
      <MockArticleListProvider
        value={createMockCtx({
          tags: () => [],
          createArticleTagsAccessor: () => () => [],
        })}
      >
        <div class="divide-base-300 w-full max-w-2xl divide-y">
          <Story />
        </div>
      </MockArticleListProvider>
    ),
  ],
};
