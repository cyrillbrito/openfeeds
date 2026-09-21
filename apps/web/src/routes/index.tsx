// The inbox: everything unread, newest first, across every feed.
import { createMemo, createSignal, isPending, Loading, Show } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';
import { useAction } from '@solidjs/router';

import {
  ArticleList,
  ArticleListSkeleton,
  LIST_MEASURE,
} from '../components/ArticleList';
import { Button } from '../components/ui/button';
import { getFeeds, getInbox, getUnreadCount, markFeedRead } from '../lib/feeds';

// `preload` is also the manifest the single-flight collector uses: after a
// mutation only these queries come back on its response. The sidebar's are
// listed because the shell renders on every route.
export const route = {
  preload: () => {
    void getInbox(true);
    void getFeeds();
    void getUnreadCount();
  },
} satisfies RouteDefinition;

export default function Inbox() {
  const [unreadOnly, setUnreadOnly] = createSignal(true);
  const articles = createMemo(() => getInbox(unreadOnly()));
  const markAllRead = useAction(markFeedRead);

  // `isPending` performs the read it is given, so it belongs under the
  // boundary that owns the first-paint fallback. After that it is true only
  // while a changed input — the filter — is being answered.
  const updating = () => isPending(() => articles());

  return (
    <>
      {/* Outside the scroller, so it is on screen on the first frame. */}
      <header class="shrink-0 border-b border-border">
        <div class={`flex items-center gap-3 px-6 py-4 ${LIST_MEASURE}`}>
          <h1 class="flex-1 text-lg font-semibold">Inbox</h1>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUnreadOnly((value) => !value)}
          >
            {unreadOnly() ? 'Show all' : 'Show unread'}
          </Button>

          {/* Its own boundary: this condition reads the articles, and a
              not-ready read must not take the header down with it. */}
          <Loading fallback={null}>
            <Show when={articles().length > 0 && unreadOnly()}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void markAllRead(undefined)}
              >
                Mark all read
              </Button>
            </Show>
          </Loading>
        </div>
      </header>

      {/*
        No `on` here, unlike the [id] routes: toggling the filter revalidates
        the screen you are already looking at, so keeping the current list
        and dimming it is right. Arriving from another route mounts a fresh
        boundary, which shows the skeleton on its own.
      */}
      <div class="min-h-0 flex-1 overflow-y-auto">
        <Loading fallback={<ArticleListSkeleton />}>
          <div
            class={[
              'transition-opacity duration-150',
              { 'opacity-50': updating() },
            ]}
          >
            <ArticleList
              items={articles()}
              showFeedName
              emptyMessage={
                unreadOnly()
                  ? 'Inbox zero. Nothing unread.'
                  : 'No articles yet — add a feed to get started.'
              }
            />
          </div>
        </Loading>
      </div>
    </>
  );
}
