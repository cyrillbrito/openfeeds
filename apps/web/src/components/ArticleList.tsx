import type { Article, Feed, Tag } from '@repo/shared/types';
import { Link } from '@tanstack/solid-router';
import ChevronDownIcon from 'lucide-solid/icons/chevron-down';
import { createSignal, For, Show, type JSX } from 'solid-js';
import { ArticleCard } from './ArticleCard';
import {
  AllCaughtUpIllustration,
  FeedIllustration,
  NoReadArticlesIllustration,
  TagsIllustration,
} from './Icons';
import type { ReadStatus } from './ReadStatusToggle';

const ARTICLES_PER_PAGE = 20;

interface ArticleListProps {
  articles: Article[];
  feeds: Feed[];
  tags: Tag[];
  onUpdateArticle: (articleId: string, updates: { isRead?: boolean; tags?: string[] }) => void;
  readStatus?: ReadStatus;
  context?: 'inbox' | 'feed' | 'tag';
  emptyState?: {
    icon: string | JSX.Element;
    title: string;
    description: string;
    actions?: {
      primary?: { text: string; href: string };
      secondary?: { text: string; href: string };
    };
  };
}

export function ArticleList(props: ArticleListProps) {
  // Generate contextual empty state based on readStatus and context
  const getContextualEmptyState = (): NonNullable<ArticleListProps['emptyState']> => {
    const readStatus = props.readStatus;
    const context = props.context || 'inbox';

    // If parent provides custom empty state, use it
    if (props.emptyState) {
      return props.emptyState;
    }

    if (readStatus === 'unread') {
      const contextMessages = {
        inbox: {
          icon: <AllCaughtUpIllustration />,
          title: 'All Caught Up!',
          description:
            'No unread articles right now. New content will appear here when your feeds sync.',
        },
        feed: {
          icon: <AllCaughtUpIllustration />,
          title: 'All Caught Up!',
          description: 'This feed has no unread articles at the moment.',
        },
        tag: {
          icon: <AllCaughtUpIllustration />,
          title: 'All Caught Up!',
          description: 'No unread articles with this tag right now.',
        },
      };
      return contextMessages[context];
    }

    if (readStatus === 'read') {
      const contextMessages = {
        inbox: {
          icon: <NoReadArticlesIllustration />,
          title: 'No Read Articles',
          description: 'Articles you mark as read will appear here.',
        },
        feed: {
          icon: <NoReadArticlesIllustration />,
          title: 'No Read Articles',
          description: 'Articles you read from this feed will appear here.',
        },
        tag: {
          icon: <NoReadArticlesIllustration />,
          title: 'No Read Articles',
          description: 'Read articles with this tag will appear here.',
        },
      };
      return contextMessages[context];
    }

    const contextMessages = {
      inbox: {
        icon: <FeedIllustration />,
        title: 'No Articles Found',
        description:
          "You don't have any articles yet. Add some RSS feeds and sync them to see articles here.",
        actions: {
          primary: { text: 'Add Feeds', href: '/feeds' },
          secondary: { text: 'Browse Tags', href: '/tags' },
        },
      },
      feed: {
        icon: <FeedIllustration />,
        title: 'No Articles Found',
        description: "This feed doesn't have any articles yet.",
        actions: {
          primary: { text: 'Browse Feeds', href: '/feeds' },
        },
      },
      tag: {
        icon: <TagsIllustration />,
        title: 'No Articles Found',
        description:
          "This tag doesn't have any articles yet. Articles will appear here once feeds with this tag are synced and contain content.",
        actions: {
          primary: { text: 'Manage Feeds', href: '/feeds' },
          secondary: { text: 'Browse Tags', href: '/tags' },
        },
      },
    };
    return contextMessages[context];
  };

  const emptyState = getContextualEmptyState();

  const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);

  const visibleArticles = () => props.articles.slice(0, visibleCount());
  const hasMoreArticles = () => props.articles.length > visibleCount();
  const remainingCount = () => props.articles.length - visibleCount();

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  return (
    <Show
      when={props.articles && props.articles.length > 0}
      fallback={
        <div class="py-16 text-center">
          <div class="mb-4 flex justify-center">{emptyState.icon}</div>
          <h2 class="mb-2 text-2xl font-semibold">{emptyState.title}</h2>
          <p class="text-base-content-gray mb-6">{emptyState.description}</p>
          {emptyState.actions && (
            <div class="flex justify-center gap-4">
              {emptyState.actions.primary && (
                <Link to={emptyState.actions.primary.href} class="btn btn-primary">
                  {emptyState.actions.primary.text}
                </Link>
              )}
              {emptyState.actions.secondary && (
                <Link to={emptyState.actions.secondary.href} class="btn btn-outline">
                  {emptyState.actions.secondary.text}
                </Link>
              )}
            </div>
          )}
        </div>
      }
    >
      <div class="divide-base-300 w-full divide-y">
        <For each={visibleArticles()}>
          {(article) => (
            <ArticleCard
              article={article}
              feeds={props.feeds}
              tags={props.tags}
              onUpdateArticle={props.onUpdateArticle}
            />
          )}
        </For>
      </div>

      <Show when={hasMoreArticles()}>
        <div class="mt-6 flex justify-center">
          <button class="btn btn-outline btn-wide gap-2" onClick={handleLoadMore}>
            <ChevronDownIcon size={20} />
            Load More ({remainingCount()} remaining)
          </button>
        </div>
      </Show>
    </Show>
  );
}
