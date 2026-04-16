import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { fn } from 'storybook/test';
import { withRouter } from './articles-stories.decorator';
import { tagFixtures } from './articles-stories.fixtures';
import { ArticleTagManager } from './ArticleTagManager';

const meta: Meta<typeof ArticleTagManager> = {
  title: 'Articles/ArticleTagManager',
  component: ArticleTagManager,
  decorators: [withRouter],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Default state — requires live TanStack DB context for tags to appear */
export const Default: Story = {
  args: {
    articleId: 'article-1',
    tags: tagFixtures,
    onAddTag: fn().mockName('onAddTag'),
    onRemoveTag: fn().mockName('onRemoveTag'),
  },
};
