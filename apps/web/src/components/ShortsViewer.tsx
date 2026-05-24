import type { Article, Feed } from '@repo/domain/client';
import { Link } from '@tanstack/solid-router';
import { ArrowLeft, ChevronLeft, ChevronRight, EllipsisVertical, X } from 'lucide-solid';
import { posthog } from 'posthog-js';
import {
  createEffect,
  createMemo,
  createSignal,
  ErrorBoundary,
  on,
  onMount,
  Show,
  Suspense,
} from 'solid-js';
import { ReadStatusToggle, type ReadStatus } from '~/components/articles/ReadStatusToggle';
import { Dropdown } from './Dropdown';
import { ReadIconButton } from './ReadIconButton';
import { TimeAgo } from './TimeAgo';
import { YouTubeShortsEmbed } from './YouTubeShortsEmbed';

interface BackLinkConfig {
  to: string;
  text: string;
  params?: Record<string, string>;
}

interface ShortsViewerProps {
  readStatus: ReadStatus;
  shorts: Article[];
  feeds?: Feed[];
  backLink: BackLinkConfig;
  onSetRead?: (articleId: string, isRead: boolean) => void;
}

export function ShortsViewer(props: ShortsViewerProps) {
  const [currentIndex, setCurrentIndex] = createSignal(0);

  const currentShort = () => props.shorts[currentIndex()];
  const totalShorts = () => props.shorts.length;

  // Memo on the ID so the effect below only fires when we navigate to a
  // different short, not on every snapshot re-render for the same video.
  const currentShortId = createMemo(() => currentShort()?.id);

  const getCurrentFeed = () => {
    const short = currentShort();
    if (!short?.feedId || !props.feeds) return null;
    return props.feeds.find((f) => f.id === short.feedId) ?? null;
  };

  const canGoNext = () => currentIndex() < totalShorts() - 1;
  const canGoPrevious = () => currentIndex() > 0;

  const goToNext = () => {
    if (currentIndex() < totalShorts() - 1) setCurrentIndex((i) => i + 1);
  };

  const goToPrevious = () => {
    if (currentIndex() > 0) setCurrentIndex((i) => i - 1);
  };

  // Hide mobile browser address bar on mount.
  // TODO: move to a hook
  onMount(() => setTimeout(() => window.scrollTo(0, 1), 0));

  // Reset to first short when readStatus changes (the snapshot is also
  // refetched in the parent, so old index could be out of range).
  createEffect(
    on(
      () => props.readStatus,
      () => setCurrentIndex(0),
      { defer: true },
    ),
  );

  // Auto-mark as read when navigating to a new short.
  // Using currentShortId (memo) instead of currentShort() avoids re-firing
  // when the snapshot returns a new array reference for the same video.
  createEffect(() => {
    const id = currentShortId();
    if (id) props.onSetRead?.(id, true);
  });

  // h-dvh (not h-screen) handles mobile browser UI correctly on rotation
  return (
    <div class="relative flex h-dvh flex-col bg-black text-white">
      {/* Header */}
      <div class="flex items-center justify-between gap-2 p-2 sm:p-4">
        <div class="flex items-center gap-2">
          <Link
            to={props.backLink.to}
            params={props.backLink.params}
            class="btn btn-circle btn-ghost"
          >
            <ArrowLeft size={20} />
          </Link>
        </div>

        {/* Feed + timestamp — desktop only */}
        <div class="hidden min-w-0 flex-1 sm:block">
          <Show when={currentShort()}>
            <div class="flex items-center text-xs text-white/70">
              <Suspense>
                <Show when={getCurrentFeed()}>
                  {(feed) => (
                    <>
                      <Link
                        to="/feeds/$feedId"
                        params={{ feedId: feed().id }}
                        search={{ readStatus: 'unread' }}
                        class="text-white/90 hover:text-white hover:underline"
                      >
                        {feed().title}
                      </Link>
                      <span class="mx-1">•</span>
                    </>
                  )}
                </Show>
                <TimeAgo date={currentShort().pubDate || ''} tooltipBottom />
              </Suspense>
            </div>
          </Show>
        </div>

        <div class="flex items-center gap-2">
          <div class="text-xs text-white/70">
            {currentIndex() + 1} of {totalShorts()}
          </div>

          <ReadIconButton
            read={currentShort()?.isRead || false}
            setRead={(read) => {
              const short = currentShort();
              if (short) props.onSetRead?.(short.id, read);
            }}
          />

          <div class="hidden gap-2 sm:flex">
            <ReadStatusToggle currentStatus={props.readStatus} />
          </div>

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

      {/* Video area */}
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
                  url={currentShort().url!}
                  title={currentShort().title}
                  autoplay={true}
                  class="mx-auto aspect-9/16 min-h-0 max-w-full flex-1 sm:p-2"
                />

                <Show when={canGoNext()}>
                  <div class="absolute top-1/2 right-0 -translate-y-1/2">
                    <button
                      class="btn btn-circle btn-outline absolute right-4 z-10 border-white/50 bg-black/50 text-white shadow-lg hover:bg-white/20"
                      onClick={goToNext}
                    >
                      <ChevronRight size={24} />
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
