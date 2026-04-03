import type { Article, Feed, Tag } from '@repo/domain/client';
import { Link } from '@tanstack/solid-router';
import { createWindowVirtualizer } from '@tanstack/solid-virtual';
import { ChevronDown } from 'lucide-solid';
import { createEffect, createSignal, For, on, onCleanup, onMount, Show, type JSX } from 'solid-js';
import { ArticleCard } from './ArticleCard';
import {
  AllCaughtUpIllustration,
  FeedIllustration,
  NoReadArticlesIllustration,
  TagsIllustration,
} from './Icons';
import type { ReadStatus } from './ReadStatusToggle';

export const ARTICLES_PER_PAGE = 20;

interface ArticleListProps {
  articles: Article[];
  feeds: Feed[];
  tags: Tag[];
  totalCount: number; // Total articles available (for "load more" button)
  onLoadMore: () => void; // Callback to load more
  onUpdateArticle: (articleId: string, updates: { isRead?: boolean; isArchived?: boolean }) => void;
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
  let autoLoadTriggerRef: HTMLDivElement | undefined;
  let listRef: HTMLDivElement | undefined;
  const [isAutoLoading, setIsAutoLoading] = createSignal(false);
  const [scrollMargin, setScrollMargin] = createSignal(0);

  const rowVirtualizer = createWindowVirtualizer({
    count: props.articles.length,
    estimateSize: () => 260,
    overscan: 6,
    scrollMargin: 0,
    getItemKey: (index) => props.articles[index]?.id ?? index,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

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

  // Parent controls pagination now - we just show what we receive
  const hasMoreArticles = () => props.articles.length < props.totalCount;
  const remainingCount = () => props.totalCount - props.articles.length;
  const virtualItems = () => rowVirtualizer.getVirtualItems();
  const paddingTop = () => {
    const first = virtualItems()[0];
    if (!first) return 0;
    return Math.max(0, first.start - scrollMargin());
  };
  const paddingBottom = () => {
    const items = virtualItems();
    const last = items[items.length - 1];
    if (!last) return 0;
    return Math.max(0, rowVirtualizer.getTotalSize() - last.end);
  };

  const updateScrollMargin = () => {
    if (!listRef) return;
    setScrollMargin(listRef.offsetTop);
  };

  onMount(() => {
    updateScrollMargin();
    window.addEventListener('resize', updateScrollMargin);
    onCleanup(() => window.removeEventListener('resize', updateScrollMargin));
  });

  createEffect(
    on(
      () => props.articles.length,
      () => {
        setIsAutoLoading(false);
        queueMicrotask(updateScrollMargin);
      },
    ),
  );

  createEffect(() => {
    rowVirtualizer.setOptions({
      ...rowVirtualizer.options,
      count: props.articles.length,
      scrollMargin: scrollMargin(),
      getItemKey: (index) => props.articles[index]?.id ?? index,
    });
    rowVirtualizer.measure();
  });

  createEffect(() => {
    const trigger = autoLoadTriggerRef;
    if (!trigger || !hasMoreArticles()) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (!visible || isAutoLoading()) return;

        setIsAutoLoading(true);
        props.onLoadMore();
      },
      { rootMargin: '700px 0px' },
    );

    observer.observe(trigger);
    onCleanup(() => observer.disconnect());
  });

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
      <div ref={(el) => (listRef = el)} class="w-full">
        <div style={{ height: `${paddingTop()}px` }} aria-hidden="true" />
        <For each={virtualItems()}>
          {(item) => {
            const article = () => props.articles[item.index];

            return (
              <div
                data-index={item.index}
                ref={(el) => {
                  el.setAttribute('data-index', String(item.index));
                  rowVirtualizer.measureElement(el);
                }}
                class="border-base-300 w-full border-b"
              >
                <Show when={article()}>
                  <ArticleCard
                    article={article()!}
                    feeds={props.feeds}
                    tags={props.tags}
                    onUpdateArticle={props.onUpdateArticle}
                  />
                </Show>
              </div>
            );
          }}
        </For>
        <div style={{ height: `${paddingBottom()}px` }} aria-hidden="true" />
      </div>

      <Show when={hasMoreArticles()}>
        <div ref={(el) => (autoLoadTriggerRef = el)} class="h-px w-full" aria-hidden="true" />
        <div class="mt-6 flex justify-center">
          <button class="btn btn-outline btn-wide gap-2" onClick={props.onLoadMore}>
            <ChevronDown size={20} />
            Load More ({remainingCount()} remaining)
          </button>
        </div>
      </Show>
    </Show>
  );
}
