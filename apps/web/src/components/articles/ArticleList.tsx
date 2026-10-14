import { Link } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
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
    icon: string | ReactNode;
    title: string;
    description: string;
    actions?: {
      primary?: { text: string; href: string };
      secondary?: { text: string; href: string };
    };
  };
}

export function ArticleList({ emptyState }: ArticleListProps) {
  const ctx = useArticleList();

  const state = useMemo((): NonNullable<ArticleListProps['emptyState']> => {
    if (emptyState) return emptyState;

    const readStatus = ctx.readStatus;
    const context = ctx.context;

    if (readStatus === 'unread') {
      const contextMessages = {
        inbox: {
          icon: <AllCaughtUpIllustration />,
          title: 'All Caught Up!',
          description: 'No new articles to read. Check back later for fresh content.',
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
        description: "You don't have any articles yet. Follow some feeds to see articles here.",
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
          "This tag doesn't have any articles yet. Articles will appear here once feeds with this tag have new content.",
        actions: {
          primary: { text: 'Feeds', href: '/feeds' },
          secondary: { text: 'Browse Tags', href: '/tags' },
        },
      },
    };
    return contextMessages[context];
  }, [emptyState, ctx.readStatus, ctx.context]);
  const hasMoreArticles = ctx.articles.length < ctx.totalCount;
  const remainingCount = ctx.totalCount - ctx.articles.length;

  if (ctx.articles.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mb-4 flex justify-center">{state.icon}</div>
        <h2 className="mb-2 text-2xl font-semibold">{state.title}</h2>
        <p className="text-base-content-gray mb-6">{state.description}</p>
        {state.actions && (
          <div className="flex justify-center gap-4">
            {state.actions.primary && (
              <Link to={state.actions.primary.href as any} className="btn btn-primary">
                {state.actions.primary.text}
              </Link>
            )}
            {state.actions.secondary && (
              <Link to={state.actions.secondary.href as any} className="btn btn-outline">
                {state.actions.secondary.text}
              </Link>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="divide-base-300 w-full divide-y">
        {ctx.articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {hasMoreArticles && (
        <div className="mt-6 flex justify-center">
          <button className="btn btn-outline btn-wide gap-2" onClick={ctx.loadMore}>
            <ChevronDown size={20} />
            Load More ({remainingCount} remaining)
          </button>
        </div>
      )}
    </>
  );
}
