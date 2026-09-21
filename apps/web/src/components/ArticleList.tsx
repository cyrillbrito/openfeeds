// The article list, shared by the inbox and by a single feed's page.
//
// ONE row component with layout branches following `articles.kind`, not a
// card/list toggle the user has to manage. An inbox is heterogeneous by
// nature and a uniform card scans worse than a plain list.
//
// The rule that matters most is negative: an item with no image gets NO
// image slot — no grey box, no letter avatar. A placeholder is the single
// biggest reason a reader looks broken rather than sparse.
import { createMemo, createSignal, For, Repeat, Show } from 'solid-js';
import { useAction } from '@solidjs/router';

import type { ArticleListItem } from '../server/feeds/queries';
import { toggleRead } from '../lib/feeds';
import { paths } from '../router';
import { Skeleton } from './ui/skeleton';

/** Relative for anything recent, absolute once it stops being useful. */
function formatWhen(date: Date | null) {
  if (!date) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** `8:12`, or `1:04:22` once it passes an hour. */
function formatDuration(seconds: number | null) {
  if (!seconds || seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(secs)}`
    : `${minutes}:${pad(secs)}`;
}

/**
 * The sticky separator's label. The granularity coarsens with age — days for
 * the last week, months after that — so a blog that posts monthly does not
 * get a separator above every single row.
 */
function dayLabel(date: Date | null) {
  if (!date) return 'Undated';

  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });

  return date.toLocaleDateString(undefined, {
    month: 'long',
    // The year is noise until it stops being this one.
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

interface DayGroup {
  label: string;
  items: ArticleListItem[];
}

/**
 * Consecutive, not bucketed: the query already returns newest first, so the
 * list keeps exactly the order the database chose even when dates lie.
 */
function groupByDay(items: ArticleListItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const label = dayLabel(item.publishedAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

/**
 * Three things here are load-bearing:
 *
 *  - The aspect ratio comes from the CALLER, so the row's height is known
 *    before the image arrives and nothing reflows when it lands.
 *  - `onError` removes the slot entirely; feed thumbnails 404 and
 *    hotlink-block constantly, and a hole is worse than the no-image layout.
 *  - `referrerpolicy` is the cheap half of the privacy problem. The full fix
 *    is a caching proxy.
 */
function Thumbnail(props: {
  src: string;
  /** Tailwind classes fixing the box's size and aspect. */
  class: string;
  /** Overlaid on the bottom-right corner. */
  duration?: string;
  /** Video and podcast rows get a play affordance; article images do not. */
  playable?: boolean;
}) {
  const [broken, setBroken] = createSignal(false);

  return (
    <Show when={!broken()}>
      <div
        class={`relative shrink-0 overflow-hidden rounded-md bg-muted ${props.class}`}
      >
        <img
          src={props.src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerpolicy="no-referrer"
          class="absolute inset-0 size-full object-cover"
          onError={() => setBroken(true)}
        />

        <Show when={props.playable}>
          <span class="pointer-events-none absolute inset-0 grid place-items-center">
            <svg viewBox="0 0 34 34" class="size-8 drop-shadow" aria-hidden="true">
              <circle
                cx="17"
                cy="17"
                r="16"
                fill="rgba(0,0,0,.5)"
                stroke="rgba(255,255,255,.85)"
                stroke-width="1.5"
              />
              <path d="M14 11.5 L23 17 L14 22.5 Z" fill="#fff" />
            </svg>
          </span>
        </Show>

        <Show when={props.duration}>
          {(duration) => (
            <span class="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-px text-[11px] font-semibold tabular-nums text-white">
              {duration()}
            </span>
          )}
        </Show>
      </div>
    </Show>
  );
}

function ArticleRow(props: {
  article: ArticleListItem;
  showFeedName?: boolean;
}) {
  const setRead = useAction(toggleRead);

  const article = () => props.article;
  const kind = () => article().kind;
  const isVideo = () => kind() === 'video' || kind() === 'short';
  const isNote = () => kind() === 'note';

  /**
   * A Short gets a PORTRAIT box: `hqdefault` is 480x360 with the vertical
   * frame pillarboxed inside, so cropping to 9:16 removes the bars where
   * 16:9 would keep them and lose the subject. Narrow, so one Short does not
   * tower over the rows around it.
   */
  const thumbnailBox = () => {
    if (kind() === 'short') return 'w-16 aspect-[9/16]';
    if (kind() === 'video') return 'w-40 aspect-video';
    return 'w-28 aspect-[16/10]';
  };

  return (
    <li
      class={[
        'group relative flex items-start gap-4 px-6 py-4 transition-colors hover:bg-accent/50',
        { 'opacity-60': article().isRead },
      ]}
    >
      {/* The unread dot doubles as the toggle. */}
      <button
        type="button"
        class={[
          'mt-1.5 size-2.5 shrink-0 cursor-pointer rounded-full transition-colors',
          {
            'bg-primary': !article().isRead,
            'bg-transparent ring-1 ring-border': article().isRead,
          },
        ]}
        aria-label={article().isRead ? 'Mark as unread' : 'Mark as read'}
        onClick={() => void setRead(article().id, !article().isRead)}
      />

      <div class="flex min-w-0 flex-1 items-start gap-4">
        {/* A podcast's square art goes LEFT: on the right it reads as a
            video thumbnail that loaded at the wrong aspect. */}
        <Show when={kind() === 'podcast' && article().imageUrl}>
          {(src) => (
            <Thumbnail
              src={src()}
              class="w-16 aspect-square"
              playable
            />
          )}
        </Show>

        <div class="flex min-w-0 flex-1 flex-col gap-1">
          {/*
            The title IS the link out — there is no detail page, and opening
            marks it read. A note has no title, so its body is the link text.
          */}
          <a
            href={article().url ?? '#'}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => void setRead(article().id, true)}
            class={[
              'block text-sm leading-snug hover:underline',
              article().isRead ? 'font-normal' : 'font-medium',
              { 'font-normal': isNote() },
            ]}
          >
            {isNote() ? (article().excerpt ?? article().title) : article().title}
          </a>

          {/* Empty string means the kind HAS no excerpt, so this is a falsy
              check rather than a null check. */}
          <Show when={!isNote() && article().excerpt}>
            {(preview) => (
              <p
                class={[
                  'text-sm leading-snug text-muted-foreground',
                  // A row with no thumbnail has earned the extra line.
                  article().imageUrl ? 'line-clamp-2' : 'line-clamp-3',
                ]}
              >
                {preview()}
              </p>
            )}
          </Show>

          <p class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <Show when={props.showFeedName}>
              <a
                href={paths.feeds(article().feedId)}
                class="font-medium hover:underline"
              >
                {article().feedTitle}
              </a>
              <span aria-hidden="true">·</span>
            </Show>
            <Show when={article().author}>
              <span class="truncate">{article().author}</span>
              <span aria-hidden="true">·</span>
            </Show>
            <Show when={formatDuration(article().durationSeconds)}>
              {(duration) => (
                <>
                  <span class="tabular-nums">{duration()}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
            </Show>
            <span>{formatWhen(article().publishedAt)}</span>
          </p>
        </div>

        {/* Video keeps 16:9; a still image is boxier, so a mixed list still
            reads as one column. */}
        <Show when={kind() !== 'podcast' && article().imageUrl}>
          {(src) => (
            <Thumbnail
              src={src()}
              class={thumbnailBox()}
              playable={isVideo()}
              duration={isVideo() ? formatDuration(article().durationSeconds) : undefined}
            />
          )}
        </Show>
      </div>

    </li>
  );
}

/**
 * The reading measure, shared by the list and the headers above it so their
 * content aligns while their borders still span the window. Not applied
 * around the whole route: the Shorts stage is full-bleed and collapses
 * inside a centred column.
 */
export const LIST_MEASURE = 'mx-auto w-full max-w-3xl';

export function ArticleList(props: {
  items: ArticleListItem[];
  /** The feed name is redundant on a single feed's own page. */
  showFeedName?: boolean;
  emptyMessage?: string;
}) {
  const groups = createMemo(() => groupByDay(props.items));

  return (
    <Show
      when={props.items.length > 0}
      fallback={
        <p class="px-6 py-16 text-center text-sm text-muted-foreground">
          {props.emptyMessage ?? 'Nothing here yet.'}
        </p>
      }
    >
      <ul class={`divide-y divide-border ${LIST_MEASURE}`}>
        <For each={groups()}>
          {(group) => (
            <>
              {/* The route header is outside this scroller, so `top-0` is
                  the right offset on every route. */}
              <li class="sticky top-0 z-[5] border-b border-border bg-background/95 px-6 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                {group.label}
              </li>
              <For each={group.items}>
                {(article) => (
                  <ArticleRow
                    article={article}
                    showFeedName={props.showFeedName}
                  />
                )}
              </For>
            </>
          )}
        </For>
      </ul>
    </Show>
  );
}

/**
 * Not a spinner: it reproduces the row geometry above, so when the data
 * lands only the pixels inside the boxes change. Every fourth row carries a
 * thumbnail, because the real list does. Widths are literal class names
 * because Tailwind 4 scans the module graph for exactly those.
 */
const TITLE_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4', 'w-1/2', 'w-2/3'];
const PREVIEW_WIDTHS = ['w-11/12', 'w-4/5', 'w-full', 'w-3/4'];

export function ArticleListSkeleton(props: { rows?: number }) {
  return (
    <ul class={`divide-y divide-border ${LIST_MEASURE}`} aria-hidden="true">
      <Repeat count={props.rows ?? 7}>
        {(index) => (
          <li class="flex items-start gap-4 px-6 py-4">
            {/* Matches the unread dot, which is never a skeleton shape. */}
            <div class="mt-1.5 size-2.5 shrink-0 rounded-full bg-muted" />

            <div class="flex min-w-0 flex-1 items-start gap-4">
              <div class="min-w-0 flex-1">
                <Skeleton
                  class={`h-4 ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`}
                />
                <Skeleton
                  class={`mt-2 h-3 ${PREVIEW_WIDTHS[index % PREVIEW_WIDTHS.length]}`}
                />
                <Skeleton class="mt-2 h-3 w-24" />
              </div>

              <Show when={index % 4 === 0}>
                <Skeleton class="w-40 shrink-0 aspect-video rounded-md" />
              </Show>
            </div>
          </li>
        )}
      </Repeat>
    </ul>
  );
}
