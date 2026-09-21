// One feed's articles.
import { createMemo, Loading, Show } from 'solid-js';
import type { RouteDefinition, RouteSectionProps } from '@solidjs/router';
import { useAction } from '@solidjs/router';

import {
  ArticleList,
  ArticleListSkeleton,
  LIST_MEASURE,
} from '../../components/ArticleList';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import {
  getFeedArticles,
  getFeeds,
  getUnreadCount,
  markFeedRead,
  refreshFeed,
} from '../../lib/feeds';

export const route = {
  preload: ({ params }) => {
    void getFeedArticles(Number(params.id));
    void getFeeds();
    void getUnreadCount();
  },
} satisfies RouteDefinition;

/** The header's own fallback: title line, two buttons, the site-url line. */
function FeedHeaderSkeleton() {
  return (
    <div aria-hidden="true">
      <div class="flex items-center gap-3">
        <Skeleton class="h-7 w-56 flex-1" />
        <Skeleton class="h-8 w-[4.5rem]" />
        <Skeleton class="h-8 w-28" />
      </div>
      <Skeleton class="mt-1.5 h-3 w-44" />
    </div>
  );
}

export default function FeedPage(props: RouteSectionProps) {
  // Read inside the memo: route params are reactive, and they are always
  // strings at runtime even with a numeric match filter, so parse here.
  const data = createMemo(() => getFeedArticles(Number(props.params.id)));
  const refresh = useAction(refreshFeed);
  const markRead = useAction(markFeedRead);

  return (
    <>
      {/*
        Outside the boundary, so the chrome paints on the first frame of the
        navigation. Only its contents wait for data.

        `on` is required here and not on the inbox: clicking a different feed
        does not remount this component — the route matches, only the param
        changes — so without it the boundary holds the previous feed's title
        and list until the new data arrives.
      */}
      <header class="shrink-0 border-b border-border">
        <div class={`px-6 py-4 ${LIST_MEASURE}`}>
        <Loading fallback={<FeedHeaderSkeleton />} on={props.params.id}>
          <Show
            when={data().feed}
            fallback={
              <h1 class="text-lg font-semibold text-muted-foreground">
                Feed not found
              </h1>
            }
          >
            {(feed) => (
              <>
                <div class="flex items-center gap-3">
                  <h1 class="flex-1 truncate text-lg font-semibold">
                    {feed().title}
                  </h1>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void refresh(feed().id)}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void markRead(feed().id)}
                  >
                    Mark all read
                  </Button>
                </div>

                <Show when={feed().siteUrl}>
                  {(url) => (
                    <a
                      href={url()}
                      target="_blank"
                      rel="noreferrer noopener"
                      class="mt-1 inline-block text-xs text-muted-foreground hover:underline"
                    >
                      {url()}
                    </a>
                  )}
                </Show>

                <Show when={feed().lastError}>
                  {(error) => (
                    <p class="mt-2 text-xs text-destructive">
                      Last fetch failed: {error()}
                    </p>
                  )}
                </Show>
              </>
            )}
          </Show>
        </Loading>
        </div>
      </header>

      {/* A second boundary, so the chrome stays put while only the list is
          replaced. */}
      <div class="min-h-0 flex-1 overflow-y-auto">
        <Loading fallback={<ArticleListSkeleton />} on={props.params.id}>
          <Show
            when={data().feed}
            fallback={
              <p class="px-6 py-16 text-center text-sm text-muted-foreground">
                That feed does not exist.
              </p>
            }
          >
            <ArticleList
              items={data().items}
              emptyMessage="This feed has no articles yet."
            />
          </Show>
        </Loading>
      </div>
    </>
  );
}
