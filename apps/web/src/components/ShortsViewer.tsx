import type { Article, Feed } from '@repo/domain/client';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, ChevronLeft, ChevronRight, EllipsisVertical, X } from 'lucide-react';
import { posthog } from 'posthog-js';
import { useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
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

export function ShortsViewer({ readStatus, shorts, feeds, backLink, onSetRead }: ShortsViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentShort = shorts[currentIndex];
  const totalShorts = shorts.length;

  // Stable ref so the auto-read effect fires only when the ID changes, not on
  // every render that produces a new array reference for the same video.
  const currentShortIdRef = useRef<string | undefined>(undefined);

  const getCurrentFeed = () => {
    if (!currentShort?.feedId || !feeds) return null;
    return feeds.find((f) => f.id === currentShort.feedId) ?? null;
  };

  const canGoNext = currentIndex < totalShorts - 1;
  const canGoPrevious = currentIndex > 0;

  const goToNext = () => {
    if (currentIndex < totalShorts - 1) setCurrentIndex((i) => i + 1);
  };

  const goToPrevious = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  // Hide mobile browser address bar on mount.
  useEffect(() => {
    setTimeout(() => window.scrollTo(0, 1), 0);
  }, []);

  // Reset to first short when readStatus changes.
  const prevReadStatusRef = useRef(readStatus);
  useEffect(() => {
    if (prevReadStatusRef.current !== readStatus) {
      prevReadStatusRef.current = readStatus;
      setCurrentIndex(0);
    }
  }, [readStatus]);

  // Auto-mark as read when navigating to a new short.
  useEffect(() => {
    const id = currentShort?.id;
    if (id && id !== currentShortIdRef.current) {
      currentShortIdRef.current = id;
      onSetRead?.(id, true);
    }
  }, [currentShort?.id, onSetRead]);

  const currentFeed = getCurrentFeed();

  return (
    <div className="relative flex h-dvh flex-col bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-4">
        <div className="flex items-center gap-2">
          <Link
            to={backLink.to}
            params={backLink.params}
            className="btn btn-circle btn-ghost"
          >
            <ArrowLeft size={20} />
          </Link>
        </div>

        {/* Feed + timestamp — desktop only */}
        <div className="hidden min-w-0 flex-1 sm:block">
          {currentShort && (
            <div className="flex items-center text-xs text-white/70">
              {currentFeed && (
                <>
                  <Link
                    to="/feeds/$feedId"
                    params={{ feedId: currentFeed.id }}
                    search={{ readStatus: 'unread' }}
                    className="text-white/90 hover:text-white hover:underline"
                  >
                    {currentFeed.title}
                  </Link>
                  <span className="mx-1">•</span>
                </>
              )}
              <TimeAgo date={currentShort.pubDate || ''} tooltipBottom />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="text-xs text-white/70">
            {currentIndex + 1} of {totalShorts}
          </div>

          <ReadIconButton
            read={currentShort?.isRead || false}
            setRead={(read) => {
              if (currentShort) onSetRead?.(currentShort.id, read);
            }}
          />

          <div className="hidden gap-2 sm:flex">
            <ReadStatusToggle currentStatus={readStatus} />
          </div>

          <div className="sm:hidden">
            <Dropdown
              end
              btnClasses="btn-sm btn-ghost btn-circle text-white"
              btnContent={<EllipsisVertical size={20} />}
            >
              {readStatus === 'unread' ? (
                <li>
                  <Link
                    to="."
                    search={(prev: Record<string, any>) => ({
                      ...prev,
                      readStatus: 'all' as ReadStatus,
                    })}
                    className="flex items-center gap-2"
                  >
                    Show All Shorts
                  </Link>
                </li>
              ) : (
                <li>
                  <Link
                    to="."
                    search={(prev: Record<string, any>) => ({
                      ...prev,
                      readStatus: 'unread' as ReadStatus,
                    })}
                    className="flex items-center gap-2"
                  >
                    Show Unread Only
                  </Link>
                </li>
              )}
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Video area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => {
            posthog.captureException(error);
            return (
              <div className="flex flex-col items-center justify-center bg-black text-center text-white">
                <div className="mb-4">
                  <X size={96} className="text-red-500" />
                </div>
                <h2 className="mb-2 text-2xl font-semibold text-white">Something went wrong</h2>
                <p className="mb-6 text-white/60">{error.message}</p>
                <button className="btn btn-primary" onClick={resetErrorBoundary}>
                  Try Again
                </button>
              </div>
            );
          }}
        >
          {totalShorts === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center bg-black p-8 text-center text-white">
              <div className="mb-6 text-8xl">📱</div>
              <h2 className="mb-4 text-3xl font-bold text-white">No Shorts Available</h2>
              <p className="mb-8 max-w-md text-lg text-white/70">
                There are no YouTube shorts to display at the moment. Check back later or try
                adjusting your filters.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <Link to={backLink.to} params={backLink.params} className="btn btn-primary">
                  {backLink.text}
                </Link>
              </div>
            </div>
          ) : currentShort ? (
            <>
              {canGoPrevious && (
                <div className="absolute top-1/2 left-0 -translate-y-1/2">
                  <button
                    className="btn btn-circle btn-outline absolute left-4 z-10 border-white/50 bg-black/50 text-white shadow-lg hover:bg-white/20"
                    onClick={goToPrevious}
                  >
                    <ChevronLeft size={24} />
                  </button>
                </div>
              )}

              <YouTubeShortsEmbed
                url={currentShort.url!}
                title={currentShort.title}
                autoplay={true}
                className="mx-auto aspect-9/16 min-h-0 max-w-full flex-1 sm:p-2"
              />

              {canGoNext && (
                <div className="absolute top-1/2 right-0 -translate-y-1/2">
                  <button
                    className="btn btn-circle btn-outline absolute right-4 z-10 border-white/50 bg-black/50 text-white shadow-lg hover:bg-white/20"
                    onClick={goToNext}
                  >
                    <ChevronRight size={24} />
                  </button>
                </div>
              )}
            </>
          ) : null}
        </ErrorBoundary>
      </div>
    </div>
  );
}
