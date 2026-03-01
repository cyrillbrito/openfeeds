import type { Article, Feed } from '@repo/domain/client';
import { Link } from '@tanstack/solid-router';
import { ArrowLeft, ChevronLeft, ChevronRight, EllipsisVertical, X } from 'lucide-solid';
import posthog from 'posthog-js';
import {
  createEffect,
  createSignal,
  ErrorBoundary,
  onMount,
  Show,
  Suspense,
  type Accessor,
} from 'solid-js';
import { Dropdown } from './Dropdown';
import { ReadIconButton } from './ReadIconButton';
import { ReadStatusToggle, type ReadStatus } from './ReadStatusToggle';
import { TimeAgo } from './TimeAgo';
import { YouTubeShortsEmbed } from './YouTubeShortsEmbed';

interface BackLinkConfig {
  to: string;
  text: string;
  params?: Record<string, string>;
}

interface ShortsViewerProps {
  readStatus: ReadStatus;

  /** Needs to pass the accessor to make sure the suspense and error boundary work */
  shortsAccessor: Accessor<Article[]>;
  /** Feed data to display feed information for each article */
  feedsAccessor?: Accessor<Feed[]>;
  backLink: BackLinkConfig;
  /** Informs if there are more shorts that can be fetched */
  hasMore: boolean;
  /** Called when reaching the end of the shorts, and there are more to be loaded */
  loadMore?: () => void;
  isLoadingMore?: boolean;
  /** Called when user clicks to watch a video, to mark article as read */
  onMarkAsRead?: (articleId: string) => void;

  /** Called when user manually toggles read status */
  onToggleRead?: (articleId: string, isRead: boolean) => void;
}

export function ShortsViewer(props: ShortsViewerProps) {
  const [currentIndex, setCurrentIndex] = createSignal(0);

  const currentShort = () => props.shortsAccessor()[currentIndex()];
  const totalShorts = () => props.shortsAccessor().length;

  const goToNext = () => {
    const nextIndex = currentIndex() + 1;
    const shorts = props.shortsAccessor();

    if (nextIndex < shorts.length) {
      setCurrentIndex(nextIndex);

      // Auto-load more when 2 videos away from the end
      const videosFromEnd = shorts.length - nextIndex - 1;
      if (videosFromEnd <= 2 && props.hasMore && !props.isLoadingMore && props.loadMore) {
        props.loadMore();
      }
    } else if (props.hasMore && !props.isLoadingMore && props.loadMore) {
      props.loadMore();
    }
  };

  const goToPrevious = () => {
    const prevIndex = currentIndex() - 1;
    if (prevIndex >= 0) {
      setCurrentIndex(prevIndex);
    }
  };

  const canGoNext = () => {
    return currentIndex() < props.shortsAccessor().length - 1 || props.hasMore;
  };

  const canGoPrevious = () => {
    return currentIndex() > 0;
  };

  const getCurrentFeed = () => {
    const current = currentShort();
    if (!current || !current.feedId || !props.feedsAccessor) return null;
    const feeds = props.feedsAccessor();
    return feeds.find((feed) => feed.id === current.feedId) || null;
  };

  // Modern mobile browser UI hiding approach
  // TODO If this works move to a hook or something
  onMount(() => {
    setTimeout(function () {
      // This hides the address bar:
      window.scrollTo(0, 1);
    }, 0);
  });

  // Mark current short as read when it changes
  createEffect(() => {
    const short = currentShort();
    if (short && !short.isRead && props.onMarkAsRead) {
      props.onMarkAsRead(short.id);
    }
  });

  // h-dvh instead of h-screen to handle mobile browser UI (address bar) correctly on rotation
  return (
    <div class="relative flex h-dvh flex-col bg-black text-white">
      <div class="flex items-center justify-between gap-2 p-2 sm:p-4">
        {/* Left: Back button */}
        <div class="flex items-center gap-2">
          <Link
            to={props.backLink.to}
            params={props.backLink.params}
            class="btn btn-circle btn-ghost"
          >
            <ArrowLeft size={20} />
          </Link>
        </div>

        {/* Center: Metadata (feed link & time) - desktop only */}
        <div class="hidden min-w-0 flex-1 sm:block">
          <Show when={currentShort()}>
            <div class="flex items-center text-xs text-white/70">
              <Suspense>
                <Show when={getCurrentFeed()}>
                  <Link
                    to="/feeds/$feedId"
                    params={{ feedId: getCurrentFeed()!.id.toString() }}
                    search={{ readStatus: 'unread' }}
                    class="text-white/90 hover:text-white hover:underline"
                  >
                    {getCurrentFeed()!.title}
                  </Link>
                  <span class="mx-1">•</span>
                </Show>
                <TimeAgo date={currentShort().pubDate || ''} tooltipBottom />
              </Suspense>
            </div>
          </Show>
        </div>

        {/* Right: Actions */}
        <div class="flex items-center gap-2">
          {/* Counter */}
          <div class="text-xs text-white/70">
            {currentIndex() + 1} of {totalShorts()}
            {props.hasMore && ' (+more)'}
          </div>

          {/* Read Icon Button */}
          <ReadIconButton
            read={currentShort()?.isRead || false}
            setRead={(read) => {
              const short = currentShort();
              if (!short || !props.onToggleRead) return;
              props.onToggleRead(short.id, read);
            }}
          />

          {/* Desktop: Show buttons directly */}
          <div class="hidden gap-2 sm:flex">
            <ReadStatusToggle currentStatus={props.readStatus} />
          </div>

          {/* Mobile: Ellipsis dropdown */}
          <div class="sm:hidden">
            <Dropdown
              end
              btnClasses="btn-sm btn-ghost btn-circle text-white"
              btnContent={<EllipsisVertical size={20} />}
            >
              <Show
                when={props.readStatus === 'unread'}
                fallback={
                  <li>
                    <Link
                      to="."
                      search={(prev: Record<string, any>) => ({
                        ...prev,
                        readStatus: 'unread' as ReadStatus,
                      })}
                      class="flex items-center gap-2"
                    >
                      Show Unread Only
                    </Link>
                  </li>
                }
              >
                <li>
                  <Link
                    to="."
                    search={(prev: Record<string, any>) => ({
                      ...prev,
                      readStatus: 'all' as ReadStatus,
                    })}
                    class="flex items-center gap-2"
                  >
                    Show All Shorts
                  </Link>
                </li>
              </Show>
            </Dropdown>
          </div>
        </div>
      </div>
      <div class="flex flex-1 flex-col overflow-hidden">
        <ErrorBoundary
          fallback={(error, reset) => {
            posthog.captureException(error);
            return (
              <div class="flex flex-col items-center justify-center bg-black text-center text-white">
                <div class="mb-4">
                  <X size={96} class="text-red-500" />
                </div>
                <h2 class="mb-2 text-2xl font-semibold text-white">Something went wrong</h2>
                <p class="mb-6 text-white/60">{error.message}</p>
                <button class="btn btn-primary" onClick={reset}>
                  Try Again
                </button>
              </div>
            );
          }}
        >
          <Suspense
            fallback={
              <div class="flex items-center justify-center bg-black">
                <span class="loading loading-spinner loading-lg text-white"></span>
              </div>
            }
          >
            <Show
              when={totalShorts() > 0}
              fallback={
                <div class="flex flex-1 flex-col items-center justify-center bg-black p-8 text-center text-white">
                  <div class="mb-6 text-8xl">📱</div>
                  <h2 class="mb-4 text-3xl font-bold text-white">No Shorts Available</h2>
                  <p class="mb-8 max-w-md text-lg text-white/70">
                    There are no YouTube shorts to display at the moment. Check back later or try
                    adjusting your filters.
                  </p>
                  <div class="flex flex-col gap-4 sm:flex-row">
                    <Link
                      to={props.backLink.to}
                      params={props.backLink.params}
                      class="btn btn-primary"
                    >
                      {props.backLink.text}
                    </Link>
                    <Show when={props.loadMore && props.hasMore}>
                      <button
                        class="btn btn-outline btn-secondary"
                        onClick={props.loadMore}
                        disabled={props.isLoadingMore}
                      >
                        <Show when={props.isLoadingMore} fallback="Load More">
                          <span class="loading loading-spinner loading-sm"></span>
                          Loading...
                        </Show>
                      </button>
                    </Show>
                  </div>
                </div>
              }
            >
              <Show when={currentShort()}>
                <Show when={canGoPrevious()}>
                  <div class="absolute top-1/2 left-0 -translate-y-1/2">
                    <button
                      class="btn btn-circle btn-outline absolute left-4 z-10 border-white/50 bg-black/50 text-white shadow-lg hover:bg-white/20"
                      onClick={goToPrevious}
                    >
                      <ChevronLeft size={24} />
                    </button>
                  </div>
                </Show>

                <YouTubeShortsEmbed
                  url={currentShort()!.url!}
                  title={currentShort().title}
                  autoplay={true}
                  class="mx-auto aspect-9/16 min-h-0 max-w-full flex-1 sm:p-2"
                />

                {/* Next Button */}
                <Show when={canGoNext()}>
                  <div class="absolute top-1/2 right-0 -translate-y-1/2">
                    <button
                      class="btn btn-circle btn-outline absolute right-4 z-10 border-white/50 bg-black/50 text-white shadow-lg hover:bg-white/20"
                      onClick={goToNext}
                      disabled={currentIndex() === totalShorts() - 1 && props.isLoadingMore}
                    >
                      <Show
                        when={currentIndex() === totalShorts() - 1 && props.isLoadingMore}
                        fallback={<ChevronRight size={24} />}
                      >
                        <span class="loading loading-spinner loading-sm"></span>
                      </Show>
                    </button>
                  </div>
                </Show>
              </Show>
            </Show>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
