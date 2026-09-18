// Manage feeds: the subscription list, with health and manual controls.
import { createMemo, For, Loading, Repeat, Show } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';
import { useAction } from '@solidjs/router';

import { AddFeedDialog } from '../../components/AddFeedDialog';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { getFeeds, getUnreadCount, refreshFeed, removeFeed } from '../../lib/feeds';
import { paths } from '../../router';

export const route = {
  preload: () => {
    void getFeeds();
    void getUnreadCount();
  },
} satisfies RouteDefinition;

/** Matches the row below: title, url line, unread count, two buttons. */
function FeedTableSkeleton() {
  return (
    <ul class="divide-y divide-border" aria-hidden="true">
      <Repeat count={5}>
        {() => (
          <li class="flex items-start gap-4 px-6 py-4">
            <div class="min-w-0 flex-1">
              <Skeleton class="h-4 w-48" />
              <Skeleton class="mt-2 h-3 w-72" />
            </div>
            <Skeleton class="mt-0.5 h-3 w-16 shrink-0" />
            <div class="flex shrink-0 items-center gap-1">
              <Skeleton class="h-8 w-[4.5rem]" />
              <Skeleton class="h-8 w-20" />
            </div>
          </li>
        )}
      </Repeat>
    </ul>
  );
}

export default function FeedsPage() {
  const feeds = createMemo(() => getFeeds());
  const refresh = useAction(refreshFeed);
  const remove = useAction(removeFeed);

  return (
    <>
      <header class="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
        <h1 class="flex-1 text-lg font-semibold">Feeds</h1>
        <AddFeedDialog />
      </header>

      {/* The header above is static, so it needs no boundary and paints
          immediately. Only the table waits. */}
      <Loading fallback={<FeedTableSkeleton />}>
      <Show
        when={feeds().length > 0}
        fallback={
          <p class="px-6 py-16 text-center text-sm text-muted-foreground">
            No subscriptions yet.
          </p>
        }
      >
        <ul class="divide-y divide-border">
          <For each={feeds()}>
            {(feed) => (
              <li class="flex items-start gap-4 px-6 py-4">
                <div class="min-w-0 flex-1">
                  <a
                    href={paths.feeds(feed.id)}
                    class="text-sm font-medium hover:underline"
                  >
                    {feed.title}
                  </a>
                  <p class="mt-0.5 truncate text-xs text-muted-foreground">
                    {feed.feedUrl}
                  </p>

                  {/* A broken feed says so here instead of just going quiet. */}
                  <Show when={feed.failureCount > 0}>
                    <p class="mt-1 text-xs text-destructive">
                      Last fetch failed ({feed.failureCount}×): {feed.lastError}
                    </p>
                  </Show>
                </div>

                <span class="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                  {feed.unreadCount} unread
                </span>

                <div class="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void refresh(feed.id)}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void remove(feed.id)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
      </Loading>
    </>
  );
}
