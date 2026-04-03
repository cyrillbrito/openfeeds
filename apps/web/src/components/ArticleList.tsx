import type { Article, Feed, Tag } from '@repo/domain/client';
import { Link } from '@tanstack/solid-router';
import { createWindowVirtualizer } from '@tanstack/solid-virtual';
import { createEffect, createSignal, For, on, onCleanup, onMount, Show, type JSX } from 'solid-js';
import {
  getListAnchor,
  getListScrollY,
  setListAnchor,
  setListScrollY,
} from '~/utils/list-view-state';
import { ArticleCard } from './ArticleCard';
import {
  AllCaughtUpIllustration,
  FeedIllustration,
  NoReadArticlesIllustration,
  TagsIllustration,
} from './Icons';
import type { ReadStatus } from './ReadStatusToggle';

export const ARTICLES_PER_PAGE = 20;

function debugScroll(...args: unknown[]) {
  if (!import.meta.env.DEV) return;
  if (!(window as any).__OPENFEEDS_DEBUG_SCROLL) return;
  console.debug('[article-list-scroll]', ...args);
}

interface ArticleListProps {
  articles: Article[];
  feeds: Feed[];
  tags: Tag[];
  totalCount: number; // Total articles available (for "load more" button)
  onLoadMore: () => void; // Callback to load more
  onUpdateArticle: (articleId: string, updates: { isRead?: boolean; isArchived?: boolean }) => void;
  scrollStateKey: string;
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
  const [restoredKey, setRestoredKey] = createSignal('');
  const [isRestoring, setIsRestoring] = createSignal(false);
  const [restoreLoadMoreCount, setRestoreLoadMoreCount] = createSignal(0);

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
  const listScrollKey = () => props.scrollStateKey;
  const virtualItems = () => rowVirtualizer.getVirtualItems().filter((item) => item != null);
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
        debugScroll('articles-length-changed', {
          key: listScrollKey(),
          loaded: props.articles.length,
          total: props.totalCount,
          savedY: getListScrollY(listScrollKey()),
          currentY: window.scrollY,
        });
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

  createEffect(
    on(listScrollKey, (key) => {
      if (isRestoring()) return;
      const handleScroll = () => {
        if (isRestoring()) return;
        setListScrollY(key, window.scrollY);
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      onCleanup(() => window.removeEventListener('scroll', handleScroll));
    }),
  );

  createEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!(window as any).__OPENFEEDS_DEBUG_SCROLL) return;
    if (restoreLoadMoreCount() === 0) return;

    console.debug('[article-list-scroll]', 'restore-load-more-count', {
      key: listScrollKey(),
      count: restoreLoadMoreCount(),
      loaded: props.articles.length,
      total: props.totalCount,
    });
  });

  createEffect(() => {
    const key = listScrollKey();
    const targetScrollY = getListScrollY(key);
    const anchor = getListAnchor(key);

    debugScroll('restore-check', {
      key,
      restoredKey: restoredKey(),
      targetScrollY,
      currentY: window.scrollY,
      hasAnchor: Boolean(anchor),
      loaded: props.articles.length,
      total: props.totalCount,
    });

    if (restoredKey() === key && Math.abs(window.scrollY - (targetScrollY ?? 0)) <= 8) {
      debugScroll('restore-skip-already-restored', {
        key,
        currentY: window.scrollY,
        targetScrollY,
      });
      return;
    }

    if (targetScrollY == null) {
      setRestoredKey(key);
      debugScroll('restore-skip-no-saved-y', { key });
      return;
    }

    setIsRestoring(true);
    setRestoreLoadMoreCount(0);

    let attempts = 0;
    const maxAttempts = 24;

    const tryRestore = () => {
      attempts += 1;

      if (anchor) {
        const anchorElement = document.querySelector<HTMLElement>(
          `[data-article-id="${anchor.articleId}"]`,
        );
        if (!anchorElement && hasMoreArticles() && attempts < maxAttempts) {
          debugScroll('restore-anchor-needs-more', {
            key,
            articleId: anchor.articleId,
            attempts,
            loaded: props.articles.length,
            total: props.totalCount,
          });
          props.onLoadMore();
          setRestoreLoadMoreCount((prev) => prev + 1);
          requestAnimationFrame(tryRestore);
          return;
        }

        if (anchorElement) {
          let alignAttempts = 0;
          const maxAlignAttempts = 6;

          const alignAnchor = () => {
            alignAttempts += 1;

            const liveAnchorElement = document.querySelector<HTMLElement>(
              `[data-article-id="${anchor.articleId}"]`,
            );

            if (!liveAnchorElement) {
              setRestoredKey(key);
              setIsRestoring(false);
              return;
            }

            const diff = liveAnchorElement.getBoundingClientRect().top - anchor.delta;
            if (Math.abs(diff) <= 3 || alignAttempts >= maxAlignAttempts) {
              const finalScroll = Math.max(0, window.scrollY);
              setListScrollY(key, finalScroll);
              setRestoredKey(key);
              setIsRestoring(false);
              debugScroll('restore-anchor-applied', {
                key,
                articleId: anchor.articleId,
                delta: anchor.delta,
                finalScroll,
                diff,
                attempts,
                alignAttempts,
                loaded: props.articles.length,
                total: props.totalCount,
              });
              return;
            }

            window.scrollBy({ top: diff });
            requestAnimationFrame(alignAnchor);
          };

          requestAnimationFrame(alignAnchor);
          return;
        }
      }

      const maxScrollable = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const desiredScroll = Math.min(targetScrollY, maxScrollable);

      if (maxScrollable < targetScrollY - 16 && hasMoreArticles() && attempts < maxAttempts) {
        debugScroll('restore-needs-more', {
          key,
          targetScrollY,
          maxScrollable,
          attempts,
          loaded: props.articles.length,
          total: props.totalCount,
        });
        props.onLoadMore();
        setRestoreLoadMoreCount((prev) => prev + 1);
        requestAnimationFrame(tryRestore);
        return;
      }

      window.scrollTo({ top: desiredScroll });
      setListScrollY(key, desiredScroll);
      setRestoredKey(key);
      setIsRestoring(false);
      debugScroll('restore-applied', {
        key,
        targetScrollY,
        desiredScroll,
        maxScrollable,
        attempts,
        loaded: props.articles.length,
        total: props.totalCount,
      });
    };

    requestAnimationFrame(tryRestore);
  });

  const handleNavigateToArticle = (articleId: string, event: MouseEvent) => {
    const key = listScrollKey();
    const target = event.currentTarget as HTMLElement | null;

    if (target) {
      const card = target.closest<HTMLElement>('[data-article-id]');
      if (card) {
        const delta = card.getBoundingClientRect().top;
        setListAnchor(key, articleId, delta);
      }
    }

    setListScrollY(key, window.scrollY);
    setRestoredKey('');
    debugScroll('navigate-to-article', {
      key,
      articleId,
      savedY: window.scrollY,
      loaded: props.articles.length,
      total: props.totalCount,
    });
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
      <div ref={(el) => (listRef = el)} class="w-full">
        <div style={{ height: `${paddingTop()}px` }} aria-hidden="true" />
        <For each={virtualItems()}>
          {(item) => {
            if (!item) return null;
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
                  <div data-article-id={article()!.id}>
                    <ArticleCard
                      article={article()!}
                      feeds={props.feeds}
                      tags={props.tags}
                      onUpdateArticle={props.onUpdateArticle}
                      onNavigateToArticle={handleNavigateToArticle}
                    />
                  </div>
                </Show>
              </div>
            );
          }}
        </For>
        <div style={{ height: `${paddingBottom()}px` }} aria-hidden="true" />
      </div>

      <Show when={hasMoreArticles()}>
        <div ref={(el) => (autoLoadTriggerRef = el)} class="h-px w-full" aria-hidden="true" />
      </Show>
    </Show>
  );
}
