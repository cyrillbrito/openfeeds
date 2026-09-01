import { Link } from '@tanstack/solid-router';
import { createWindowVirtualizer } from '@tanstack/solid-virtual';
import { For, Show, createSignal, onCleanup, onMount, type JSX } from 'solid-js';
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

/**
 * Rough average card height in px. Used as the virtualizer's initial estimate
 * before any item has been measured. Once items render, `measureElement` +
 * `ResizeObserver` correct each row to its real height. The estimate doesn't
 * need to be exact — it just affects how the spacer sizes itself before
 * measurement and how aggressively `overscan` pre-renders. ~200px matches a
 * text-only card; cards with YouTube thumbnails are taller and will be
 * corrected after first layout.
 */
const ESTIMATED_CARD_HEIGHT = 200;

/**
 * Number of extra items rendered above and below the visible area. Higher
 * values mean smoother scrolling (no blank flashes during fast scroll) at the
 * cost of more DOM nodes. 5 is a reasonable middle ground.
 */
const OVERSCAN = 5;

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
  };

  const emptyState = getContextualEmptyState();

  // Virtualizer setup — uses the window as the scroll element so the existing
  // page layout (sticky header, content-container) keeps working as-is and
  // the router's `scrollRestoration: true` continues to handle back-nav.
  //
  // `scrollMargin` accounts for everything rendered above the list (page
  // header, page heading, toolbar, etc.). The virtualizer needs to know this
  // offset so `virtualRow.start` is in document coordinates and our
  // `translateY` math (start - scrollMargin) positions items correctly inside
  // the spacer div.
  let parentRef: HTMLDivElement | undefined;
  const [scrollMargin, setScrollMargin] = createSignal(0);

  onMount(() => {
    const updateMargin = () => {
      if (!parentRef) return;
      // Distance from the top of the document to the start of the list.
      // Recomputed on resize because the header/toolbar above can change height.
      const rect = parentRef.getBoundingClientRect();
      setScrollMargin(rect.top + window.scrollY);
    };

    updateMargin();
    // ResizeObserver on the body catches layout shifts above the list (e.g.
    // toolbar wrapping on mobile, font loading, sticky header height changes).
    const ro = new ResizeObserver(updateMargin);
    ro.observe(document.body);
    window.addEventListener('resize', updateMargin);
    onCleanup(() => {
      ro.disconnect();
      window.removeEventListener('resize', updateMargin);
    });
  });

  const virtualizer = createWindowVirtualizer({
    get count() {
      return ctx.articles().length;
    },
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: OVERSCAN,
    get scrollMargin() {
      return scrollMargin();
    },
    // Stable key per article so the virtualizer can match rows across
    // reorders (e.g. archive removes an item, list shifts up).
    getItemKey: (index) => ctx.articles()[index]?.id ?? index,
  });

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
      {/* Spacer — absorbs the total scrollable height so the page can scroll
          even though only ~10–15 children are mounted. */}
      <div
        ref={(el) => (parentRef = el)}
        class="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        <For each={virtualizer.getVirtualItems()}>
          {(virtualRow) => {
            const article = () => ctx.articles()[virtualRow.index];
            return (
              <Show when={article()}>
                {(a) => (
                  <div
                    ref={(el) => {
                      // Solid sets dynamic attributes via createEffect AFTER ref
                      // callbacks fire, so `data-index={virtualRow.index}` would
                      // be unset when measureElement runs and indexFromElement()
                      // returns -1. Set it ourselves first so the virtualizer
                      // can read the index, observe the element, and record its
                      // measured height.
                      el.setAttribute('data-index', String(virtualRow.index));
                      virtualizer.measureElement(el);
                    }}
                    class="border-base-300 absolute top-0 left-0 w-full border-b"
                    style={{
                      transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                    }}
                  >
                    <ArticleCard article={a()} />
                  </div>
                )}
              </Show>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
