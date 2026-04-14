import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, within } from 'storybook/test';
import { ArticleCard } from './ArticleCard';
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

const meta: Meta<typeof ArticleCard> = {
  title: 'Articles/ArticleCard',
  component: ArticleCard,
  args: {
    feeds: feedFixtures,
    tags: tagFixtures,
    articleTags: articleTagFixtures,
    onUpdateArticle: fn().mockName('onUpdateArticle'),
    onAddTag: fn().mockName('onAddTag'),
    onRemoveTag: fn().mockName('onRemoveTag'),
  },
  decorators: [
    withRouter,
    (Story: () => any) => (
      <div class="divide-base-300 w-full max-w-2xl divide-y">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Unread article with tags */
export const Unread: Story = {
  args: {
    article: unreadArticle,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(unreadArticle.title)).toBeInTheDocument();
    await expect(canvas.getByText('TechCrunch')).toBeInTheDocument();
    await expect(canvas.getByText('Mark read')).toBeInTheDocument();
  },
};

/** Read article — reduced opacity */
export const Read: Story = {
  args: {
    article: readArticle,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Read')).toBeInTheDocument();
  },
};

/** Article with HTML description */
export const HtmlDescription: Story = {
  args: {
    article: htmlDescriptionArticle,
  },
};

/** YouTube Shorts article — shows thumbnail */
export const YouTubeShort: Story = {
  args: {
    article: youtubeArticle,
  },
};

/** Article without a feed (saved article) */
export const NoFeed: Story = {
  args: {
    article: noFeedArticle,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Saved Article')).toBeInTheDocument();
  },
};

/** Article with no tags at all */
export const NoTags: Story = {
  args: {
    article: unreadArticle,
    tags: [],
    articleTags: [],
  },
};
