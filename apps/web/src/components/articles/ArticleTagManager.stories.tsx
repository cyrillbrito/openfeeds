import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expect, fn, within } from 'storybook/test';
import { withRouter } from './articles-stories.decorator';
import { articleTagFixtures, tagFixtures } from './articles-stories.fixtures';
import { ArticleTagManager } from './ArticleTagManager';

const meta: Meta<typeof ArticleTagManager> = {
  title: 'Articles/ArticleTagManager',
  component: ArticleTagManager,
  decorators: [withRouter],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Article with two tags assigned */
export const WithTags: Story = {
  args: {
    articleId: 'article-1',
    tags: tagFixtures,
    articleTags: articleTagFixtures.filter((at) => at.articleId === 'article-1'),
    onAddTag: fn().mockName('onAddTag'),
    onRemoveTag: fn().mockName('onRemoveTag'),
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Tech')).toBeInTheDocument();
    await expect(canvas.getByText('AI')).toBeInTheDocument();
  },
};

/** Article with no tags — only "Tag" button visible */
export const NoTags: Story = {
  args: {
    articleId: 'article-3',
    tags: tagFixtures,
    articleTags: [],
    onAddTag: fn().mockName('onAddTag'),
    onRemoveTag: fn().mockName('onRemoveTag'),
  },
  play: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Tag')).toBeInTheDocument();
  },
};

/** All tags already assigned — dropdown shows "All tags assigned" */
export const AllTagsAssigned: Story = {
  args: {
    articleId: 'article-1',
    tags: tagFixtures.slice(0, 2), // Only Tech and AI
    articleTags: articleTagFixtures.filter((at) => at.articleId === 'article-1'), // Has Tech and AI
    onAddTag: fn().mockName('onAddTag'),
    onRemoveTag: fn().mockName('onRemoveTag'),
  },
};
