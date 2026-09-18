// The reader. Feeds that ship full content:encoded render in place; the rest
// show their summary and link out.
import { createEffect, createMemo, Loading, Repeat, Show } from 'solid-js';
import type { RouteDefinition, RouteSectionProps } from '@solidjs/router';
import { useAction } from '@solidjs/router';

import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/skeleton';
import { sanitizeHtml } from '../../lib/sanitize-html';
import { getArticleDetail, getFeeds, getUnreadCount, toggleRead } from '../../lib/feeds';
import { paths } from '../../router';

const BODY_CLASS =
  'prose-sm mt-8 space-y-4 text-sm leading-relaxed [&_a]:underline [&_h2]:text-lg [&_h2]:font-semibold [&_img]:max-w-full [&_img]:rounded [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-muted [&_pre]:p-3';

export const route = {
  preload: ({ params }) => {
    void getArticleDetail(Number(params.id));
    void getFeeds();
    void getUnreadCount();
  },
} satisfies RouteDefinition;

/**
 * Mirrors the article layout below, down to the container: same
 * `mx-auto max-w-2xl px-6 py-8`, same order of feed name, title, byline,
 * buttons, body. The measure of a good one is that switching between two
 * articles shows no reflow — only the text changing.
 */
const BODY_LINE_WIDTHS = ['w-full', 'w-full', 'w-11/12', 'w-full', 'w-2/3'];

function ArticleSkeleton() {
  return (
    <article class="mx-auto max-w-2xl px-6 py-8" aria-hidden="true">
      <Skeleton class="h-3 w-32" />

      <Skeleton class="mt-3 h-7 w-11/12" />
      <Skeleton class="mt-2 h-7 w-2/3" />

      <Skeleton class="mt-4 h-3 w-56" />

      <div class="mt-4 flex items-center gap-2">
        <Skeleton class="h-8 w-28" />
        <Skeleton class="h-8 w-24" />
      </div>

      <div class="mt-8 space-y-3">
        <Repeat count={10}>
          {(index) => (
            <Skeleton
              class={`h-3.5 ${BODY_LINE_WIDTHS[index % BODY_LINE_WIDTHS.length]}`}
            />
          )}
        </Repeat>
      </div>
    </article>
  );
}

export default function ArticlePage(props: RouteSectionProps) {
  const data = createMemo(() => getArticleDetail(Number(props.params.id)));
  const setRead = useAction(toggleRead);

  // Opening an article marks it read — the behaviour every reader has.
  createEffect(
    () => data(),
    (row) => {
      if (row && !row.article.isRead) void setRead(row.article.id, true);
    },
  );

  return (
    // Same reasoning as feeds/[id]: following a link from one article to the
    // next keeps this component mounted, so without `on` the boundary would
    // hold the article you just left on screen until the new one loaded.
    // With it, the reader swaps to the skeleton immediately and the URL,
    // scroll position and sidebar state all move on the same frame.
    <Loading fallback={<ArticleSkeleton />} on={props.params.id}>
    <Show
      when={data()}
      fallback={
        <p class="px-6 py-16 text-center text-sm text-muted-foreground">
          That article does not exist.
        </p>
      }
    >
      {(row) => (
        <article class="mx-auto max-w-2xl px-6 py-8">
          <a
            href={paths.feeds(row().feedId)}
            class="text-xs font-medium text-muted-foreground hover:underline"
          >
            {row().feedTitle}
          </a>

          <h1 class="mt-2 text-2xl font-semibold leading-tight">
            {row().article.title}
          </h1>

          <p class="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <Show when={row().article.author}>
              <span>{row().article.author}</span>
              <span aria-hidden="true">·</span>
            </Show>
            <Show when={row().article.publishedAt}>
              {(date) => <span>{date().toLocaleString()}</span>}
            </Show>
          </p>

          <div class="mt-4 flex items-center gap-2">
            <Show when={row().article.url}>
              {(url) => (
                <Button
                  as="a"
                  href={url()}
                  target="_blank"
                  rel="noreferrer noopener"
                  size="sm"
                >
                  Read on site
                </Button>
              )}
            </Show>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void setRead(row().article.id, !row().article.isRead)
              }
            >
              {row().article.isRead ? 'Mark unread' : 'Mark read'}
            </Button>
          </div>

          {/*
            The one place in the app that renders remote markup. A reader
            that will not show articles is useless, so this is unavoidable —
            but the HTML is scrubbed first, and sanitize-html.ts is explicit
            that its regex scrubbing is a stopgap for a parser-based
            sanitiser, which must land before multi-user does.
          */}
          {/* eslint-disable-next-line solid/no-innerhtml */}
          <div class={BODY_CLASS} innerHTML={sanitizeHtml(row().article.content ?? row().article.summary)} />
        </article>
      )}
    </Show>
    </Loading>
  );
}
