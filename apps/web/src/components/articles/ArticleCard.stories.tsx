import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, within } from 'storybook/test';
import { ArticleCard } from './ArticleCard';
import { withRouter } from './articles-stories.decorator';
import {
  feedFixtures,
  htmlDescriptionArticleWithTags,
  noFeedArticleWithTags,
  readArticleWithTags,
  tagFixtures,
  unreadArticleWithTags,
  youtubeArticleWithTags,
} from './articles-stories.fixtures';

const meta: Meta<typeof ArticleCard> = {
  title: 'Articles/ArticleCard',
  component: ArticleCard,
  args: {
    feeds: feedFixtures,
    tags: tagFixtures,
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
    article: unreadArticleWithTags,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(unreadArticleWithTags.title)).toBeInTheDocument();
    await expect(canvas.getByText('TechCrunch')).toBeInTheDocument();
    await expect(canvas.getByText('Mark read')).toBeInTheDocument();
  },
};

/** Read article — reduced opacity */
export const Read: Story = {
  args: {
    article: readArticleWithTags,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Read')).toBeInTheDocument();
  },
};

/** Article with HTML description */
export const HtmlDescription: Story = {
  args: {
    article: htmlDescriptionArticleWithTags,
  },
};

/** YouTube Shorts article — shows thumbnail */
export const YouTubeShort: Story = {
  args: {
    article: youtubeArticleWithTags,
  },
};

/** Article without a feed (saved article) */
export const NoFeed: Story = {
  args: {
    article: noFeedArticleWithTags,
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Saved Article')).toBeInTheDocument();
  },
};

/** Article with no tags at all */
export const NoTags: Story = {
  args: {
    article: { ...unreadArticleWithTags, articleTags: [] },
    tags: [],
  },
};
