import { Link } from '@tanstack/solid-router';
import { ChevronDown } from 'lucide-solid';
import { For, Show, type JSX } from 'solid-js';
import {
  AllCaughtUpIllustration,
  FeedIllustration,
  NoReadArticlesIllustration,
  TagsIllustration,
} from '~/components/Icons';
import { ArticleCard } from './ArticleCard';
import { useArticleList } from './ArticleListContext.shared';

interface ArticleListProps {
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
  const ctx = useArticleList();

  const getContextualEmptyState = (): NonNullable<ArticleListProps['emptyState']> => {
    if (props.emptyState) return props.emptyState;

    const readStatus = ctx.readStatus();
    const context = ctx.context;

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
          "You don't have any articles yet. Follow some feeds and sync them to see articles here.",
        actions: {
          primary: { text: 'Discover Feeds', href: '/discover' },
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
          primary: { text: 'Feeds', href: '/feeds' },
          secondary: { text: 'Browse Tags', href: '/tags' },
        },
      },
    };
    return contextMessages[context];
  };

  const emptyState = getContextualEmptyState();
  const hasMoreArticles = () => ctx.articles().length < ctx.totalCount();
  const remainingCount = () => ctx.totalCount() - ctx.articles().length;

  return (
    <Show
      when={ctx.articles().length > 0}
      fallback={
        <div class="py-16 text-center">
          <div class="mb-4 flex justify-center">{emptyState.icon}</div>
          <h2 class="mb-2 text-2xl font-semibold">{emptyState.title}</h2>
          <p class="text-base-content-gray mb-6">{emptyState.description}</p>
          <Show when={emptyState.actions}>
            {(actions) => (
              <div class="flex justify-center gap-4">
                <Show when={actions().primary}>
                  {(primary) => (
                    <Link to={primary().href} class="btn btn-primary">
                      {primary().text}
                    </Link>
                  )}
                </Show>
                <Show when={actions().secondary}>
                  {(secondary) => (
                    <Link to={secondary().href} class="btn btn-outline">
                      {secondary().text}
                    </Link>
                  )}
                </Show>
              </div>
            )}
          </Show>
        </div>
      }
    >
      <div class="divide-base-300 w-full divide-y">
        <For each={ctx.articles()}>{(article) => <ArticleCard article={article} />}</For>
      </div>

      <Show when={hasMoreArticles()}>
        <div class="mt-6 flex justify-center">
          <button class="btn btn-outline btn-wide gap-2" onClick={ctx.loadMore}>
            <ChevronDown size={20} />
            Load More ({remainingCount()} remaining)
          </button>
        </div>
      </Show>
    </Show>
  );
}
