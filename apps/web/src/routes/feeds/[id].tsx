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
        The <header> element is outside the boundary, so its height, border
        and sticky position are painted on the first frame of the
        navigation. Only its contents wait for data.
      */}
      <header class="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div class={`px-6 py-4 ${LIST_MEASURE}`}>
        {/*
          `on` is required on this route and not on the inbox, for a reason
          worth remembering: clicking a different feed in the sidebar does
          not remount this component — the route matches, only the param
          changes. So the boundary is already initialised, and without `on`
          it would hold the PREVIOUS feed's title and list until the new
          feed's data arrived. That is the "clicked but nothing moved"
          symptom. Keyed on the param, it drops to the skeleton the instant
          the id changes.
        */}
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

      {/*
        A second boundary rather than one around both. They read the same
        memo so they resolve on the same tick anyway, but keeping the header
        out of the list's boundary is what lets the chrome stay put while
        only the list is replaced.
      */}
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
    </>
  );
}
