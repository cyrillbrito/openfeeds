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

// `preload` is not just a performance hint: it is the manifest the
// single-flight collector uses. After a mutation, only the queries listed
// here come back on the mutation's own response — anything else costs a
// second round trip. The sidebar's queries are included because the shell
// renders on every route.
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

  // `isPending` replaces 1.x's `resource.loading`. It performs the read it is
  // given, so it belongs UNDER the boundary that owns the first-paint
  // fallback: before the first answer it follows the not-ready path like any
  // other read, and after that it is true only while a changed input — the
  // filter, here — is being answered.
  const updating = () => isPending(() => articles());

  return (
    <>
      {/*
        Outside every boundary. The top bar is on screen on the first frame
        of the navigation, before a byte of article data exists.
      */}
      <header class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div class={`flex items-center gap-3 px-6 py-4 ${LIST_MEASURE}`}>
        <h1 class="flex-1 text-lg font-semibold">Inbox</h1>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setUnreadOnly((value) => !value)}
        >
          {unreadOnly() ? 'Show all' : 'Show unread'}
        </Button>

        {/* Its own boundary: this button's condition reads the articles, and
            a not-ready read here must not take the header down with it. */}
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
        No `on` here, unlike the two [id] routes. Toggling the filter is a
        revalidation of the screen you are already looking at, so the right
        behaviour is the default one: keep the current list, dim it, swap it
        when the answer lands. Arriving from another route is a different
        story and needs no prop — a new route component brings a new,
        uninitialised boundary, which shows the skeleton on its own.
      */}
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
    </>
  );
}
