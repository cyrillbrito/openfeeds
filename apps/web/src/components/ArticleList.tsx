// The article list, shared by the inbox and by a single feed's page.
//
// ONE row component with layout branches, not a card-view/list-view toggle.
// The inbox is heterogeneous by nature — a 40-word link post next to a
// 3000-word essay next to a YouTube video next to a podcast episode — and
// forcing a uniform card onto all of them is what makes most modern readers
// scan worse than a plain list. So the layout follows `articles.kind`, which
// sync already decided (src/lib/article-kind.ts), and the user is never asked
// to manage a mode.
//
// The one rule that matters most is negative: an item with no image gets NO
// image slot. No grey box, no letter avatar, no 16:9 of nothing. Plenty of
// excellent feeds ship no images at all, and a placeholder is the single
// biggest reason a reader looks broken rather than sparse.
import { createMemo, createSignal, For, Repeat, Show } from 'solid-js';
import { useAction } from '@solidjs/router';

import type { ArticleListItem } from '../server/feeds/queries';
import { archiveArticle, toggleRead } from '../lib/feeds';
import { paths } from '../router';
import { Button } from './ui/button';
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
 * The sticky separator's label.
 *
 * Twelve consecutive rows reading "3h ago" tell you nothing; one "Today" over
 * the group tells you everything, and lets the per-row stamp stay quiet.
 *
 * The granularity COARSENS with age, and that is the important part. Grouping
 * strictly by day looks right on a busy feed and absurd on a sparse one: a
 * blog that posts monthly gets a separator above every single row, which is
 * more chrome than content. Days for the last week, months after that, so the
 * separator always marks a real boundary rather than restating each row's
 * own date.
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
 * Group consecutive rows by day.
 *
 * Consecutive, not sorted-into-buckets: the query already returns newest
 * first, so a linear pass is enough and the list keeps exactly the order the
 * database chose. Bucketing would silently reorder a feed whose dates lie.
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
 * The thumbnail.
 *
 * Three things here are load-bearing and none of them are visual:
 *
 *  - The aspect ratio is fixed by the CALLER, not by the image. The image is
 *    absolutely positioned inside a box that already has its final size, so
 *    the row's height is known before a byte of it arrives and nothing
 *    reflows when it lands. That holds whether or not the feed declared
 *    dimensions, which most do not.
 *  - `onError` removes the slot entirely rather than leaving a broken-image
 *    icon. Feed thumbnails 404 and hotlink-block constantly, and the row must
 *    degrade to its no-image layout instead of showing a hole.
 *  - `referrerpolicy="no-referrer"` is the cheap half of the privacy problem.
 *    Loading a publisher's image still hands them the reader's IP; withholding
 *    the referrer at least stops them learning which reader, on which page.
 *    The real fix is a caching proxy, which is a separate piece of work.
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
  const archive = useAction(archiveArticle);

  const article = () => props.article;
  const kind = () => article().kind;
  const isVideo = () => kind() === 'video' || kind() === 'short';
  const isNote = () => kind() === 'note';

  /**
   * The thumbnail's box, per kind.
   *
   * A Short gets a PORTRAIT box, and that is not a style choice. YouTube only
   * ever serves `hqdefault` at 480x360, so a Short's vertical frame arrives
   * pillarboxed inside it. Cropping that to 16:9 keeps the grey bars and
   * throws away the subject; cropping it to 9:16 removes the bars and keeps
   * the frame. The Shorts screen already relies on the same trick.
   */
  const thumbnailBox = () => {
    // Narrow, so that a portrait box costs the row about as much height as
    // a 16:9 one does — otherwise a single Short towers over the feed page.
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
        {/*
          A podcast's square artwork goes on the LEFT, alone among the kinds.
          Square art on the right reads as a video thumbnail that failed to
          load at the right aspect; on the left it reads as cover art, which
          is what it is.
        */}
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
            A note has no title of its own — the feed gave none, which is what
            made it a note — so its body IS the link text. Every other kind
            puts the title here and the excerpt underneath.
          */}
          {/*
            The title IS the link out. There is no detail page: the feed's own
            copy is a teaser more often than not, so opening the source is the
            thing the click always wanted. Opening marks it read, which is what
            a detail page used to do on mount.
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

          {/*
            Derived at sync time (server/feeds/excerpt.ts), not regex-stripped
            here on every render. An empty string means the item HAS no
            excerpt — a video, whose feed description is a wall of sponsor
            copy and timestamps — so this is a falsy check, not a null check.
          */}
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

        {/* Video keeps 16:9; a still image is boxier and narrower, so a
            mixed list still reads as one column rather than two. */}
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

      {/*
        Overlaid, not inline.

        Inline actions reserve their width on EVERY row forever, so the list
        carries a permanent empty gutter down its right edge — invisible while
        the rows are all text, and glaring the moment a thumbnail is supposed
        to sit at the edge.
      */}
      <div class="absolute right-4 top-3 flex items-center gap-0.5 rounded-full bg-background/80 p-0.5 opacity-0 shadow-sm backdrop-blur transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void archive(article().id)}
        >
          Archive
        </Button>
      </div>
    </li>
  );
}

/**
 * The measure, shared by the list and by the headers that sit above it.
 *
 * The list had no max-width, so on a wide monitor a title ran the full width
 * of the window — the single cheapest thing wrong with the old screen.
 *
 * Exported rather than applied once around the whole route, because a cap at
 * that altitude also hits screens that want the full width: the Shorts viewer
 * is a full-bleed `h-full` stage and collapses inside a centred column. The
 * headers import this so their content stays aligned with the rows while
 * their border and background still span the window.
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
              {/*
                Parked directly under the route header, which is itself sticky
                at `top-0` in this same scroll container. Two sticky elements
                in one container do not stack, so this one needs the header's
                height — published as `--route-header-h` by App.tsx, which
                measures it. The headers differ per route and can grow a line,
                so a hardcoded offset is wrong on at least one of them.
              */}
              <li class="sticky top-[var(--route-header-h,0px)] z-[5] border-b border-border bg-background/95 px-6 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
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
 * The <Loading> fallback for every place ArticleList is rendered.
 *
 * Deliberately not a spinner. It reproduces the row geometry above —
 * `px-6 py-4`, the same gap, the same dot, the same text lines — so that when
 * the data lands the only thing that changes is the pixels inside the boxes.
 *
 * Every fourth row carries a thumbnail block, because the real list does and
 * a skeleton of pure text lines would jump the moment a video row arrived.
 * Widths cycle instead of repeating so a column of them reads as text rather
 * than as a bar chart, and they are written out as literal class names
 * because Tailwind 4 scans the module graph for exactly that.
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
