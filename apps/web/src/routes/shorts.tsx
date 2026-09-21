// The shorts viewer: one vertical video per screen, scroll-snapped.
//
// No autoplay, no auto-advance, no IFrame Player API. A slide shows its
// poster until you click it, and that click is the gesture browsers demand
// before audio — so the autoplay-policy problem never arises. Exactly one
// iframe exists at a time, so a fifty-item queue is not fifty players.
//
// docs/shorts.md has the persistent-player version and what it costs.
import {
  createMemo,
  createSignal,
  For,
  Loading,
  onCleanup,
  Show,
} from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';
import { useAction } from '@solidjs/router';
// NOT from 'solid-js' — see the note in components/ui/button.tsx.
import { isServer, type JSX } from '@solidjs/web';

import { Button } from '../components/ui/button';
import type { ArticleListItem } from '../server/feeds/queries';
import { getFeeds, getShorts, getShortsCount, toggleRead } from '../lib/feeds';
import { paths } from '../router';
import { shortEmbedUrl, shortThumbnailUrl, youtubeShortId } from '../lib/shorts';
import { Skeleton } from '../components/ui/skeleton';

export const route = {
  preload: () => {
    void getShorts();
    void getFeeds();
    void getShortsCount();
  },
} satisfies RouteDefinition;

/** One full-height slide: the 9:16 stage, then a caption under it. */
function Slide(props: {
  article: ArticleListItem;
  playing: boolean;
  onPlay: () => void;
}) {
  const setRead = useAction(toggleRead);
  // Sync decided `kind` with this same function, so null means the URL
  // changed shape under us.
  const videoId = createMemo(() => youtubeShortId(props.article.url));

  return (
    <li class="flex h-full snap-start snap-always flex-col items-center justify-center gap-3 px-4">
      {/* Height first, width derived: a definite height plus an aspect ratio
          keeps the stage 9:16 at any window size, with no media query. */}
      <div class="relative aspect-[9/16] h-[72%] overflow-hidden rounded-xl bg-black shadow-lg">
        <Show
          when={videoId()}
          fallback={
            <p class="grid size-full place-items-center p-6 text-center text-sm text-white/70">
              This one no longer looks like a Short.
            </p>
          }
        >
          {(id) => (
            <Show
              when={props.playing}
              fallback={
                <button
                  type="button"
                  class="group absolute inset-0 cursor-pointer"
                  onClick={props.onPlay}
                  aria-label={`Play ${props.article.title}`}
                >
                  {/*
                    No `loading="lazy"`: inside this snap scroller Chrome
                    never resolves lazy images — they stay at naturalWidth 0
                    even fully in view, so every stage renders black.
                  */}
                  <img
                    src={shortThumbnailUrl(id())}
                    alt=""
                    class="size-full object-cover"
                    decoding="async"
                  />
                  <span class="absolute inset-0 grid place-items-center bg-black/20 transition-colors group-hover:bg-black/35">
                    <span class="grid size-16 place-items-center rounded-full bg-white/90 pl-1 text-2xl text-black">
                      ▶
                    </span>
                  </span>
                </button>
              }
            >
              <iframe
                src={shortEmbedUrl(id())}
                title={props.article.title}
                class="size-full"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowfullscreen
                referrerpolicy="strict-origin-when-cross-origin"
              />
            </Show>
          )}
        </Show>
      </div>

      <div class="w-full max-w-md shrink-0 text-center">
        <p
          class={[
            'line-clamp-2 text-sm leading-snug',
            props.article.isRead ? 'font-normal' : 'font-medium',
          ]}
        >
          {props.article.title}
        </p>

        <p class="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <a
            href={paths.feeds(props.article.feedId)}
            class="font-medium hover:underline"
          >
            {props.article.feedTitle}
          </a>
          <Show when={props.article.url}>
            {(url) => (
              <>
                <span aria-hidden="true">·</span>
                <a
                  href={url()}
                  target="_blank"
                  rel="noreferrer noopener"
                  class="hover:underline"
                >
                  Open on YouTube
                </a>
              </>
            )}
          </Show>
          <span aria-hidden="true">·</span>
          <Button
            variant="ghost"
            size="sm"
            class="h-auto px-1 py-0 text-xs font-normal"
            onClick={() =>
              void setRead(props.article.id, !props.article.isRead)
            }
          >
            {props.article.isRead ? 'Mark unread' : 'Mark read'}
          </Button>
        </p>
      </div>
    </li>
  );
}

/** One stage-shaped block. Nothing about this screen is a list of rows. */
function ShortsSkeleton() {
  return (
    <div
      class="flex h-full flex-col items-center justify-center gap-3 px-4"
      aria-hidden="true"
    >
      <Skeleton class="aspect-[9/16] h-[72%] rounded-xl" />
      <div class="w-full max-w-md space-y-2">
        <Skeleton class="mx-auto h-4 w-3/5" />
        <Skeleton class="mx-auto h-3 w-2/5" />
      </div>
    </div>
  );
}

/** Somewhere a keystroke means text, not a command. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof globalThis.HTMLElement)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable], [role="dialog"]'),
  );
}

/** Something Enter or Space would activate on its own. */
function isControl(target: EventTarget | null): boolean {
  if (!(target instanceof globalThis.HTMLElement)) return false;
  return Boolean(target.closest('button, a[href], [role="button"]'));
}

export default function Shorts() {
  const shorts = createMemo(() => getShorts());
  // A single id, not a set: switching slides tears the iframe down for free.
  const [playing, setPlaying] = createSignal<number | null>(null);
  // Every slide is exactly the scroller's height and snapping is mandatory,
  // so scroll position divides out to an index — no IntersectionObserver.
  const [index, setIndex] = createSignal(0);

  let scroller: HTMLDivElement | undefined;
  const setRead = useAction(toggleRead);

  const current = () => shorts()[index()];

  /**
   * The one place the current slide changes, from key, button or wheel.
   * Moving off a slide REMOVES its iframe — a plain embed exposes no pause
   * to script, so a video scrolled past would otherwise keep talking.
   */
  function focusIndex(next: number) {
    if (next === index()) return;
    setIndex(next);
    setPlaying(null);
  }

  function goTo(next: number) {
    const items = shorts();
    if (!scroller || items.length === 0) return;
    const clamped = Math.max(0, Math.min(next, items.length - 1));
    // Set it here as well as in onScroll so the counter and the disabled
    // states move on the press rather than on the scroll event.
    focusIndex(clamped);
    // Instant, not smooth: neither `scrollTo({behavior:'smooth'})` nor CSS
    // `scroll-behavior` moves this container a pixel, a known fight with
    // `scroll-snap-type: mandatory`. Assigning scrollTop always works.
    scroller.scrollTop = clamped * scroller.clientHeight;
  }

  function play(article: ArticleListItem | undefined) {
    if (!article) return;
    setPlaying(article.id);
    // Playing it IS reading it. The queue keeps read shorts, so the
    // revalidation dims the caption instead of yanking the video away.
    if (!article.isRead) void setRead(article.id, true);
  }

  /**
   * Keyboard control, on `window` so it works before anyone clicks into the
   * page. Once focus is inside the cross-origin player its key events never
   * reach us — which is why the on-screen buttons are not decoration. No
   * pause or mute key for the same reason; YouTube's own k/m work in-player.
   */
  if (!isServer) {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      // Enter and Space belong to whichever control has focus: after clicking
      // "Next short" the button keeps focus, and handling Enter here too
      // would press the button AND start the video.
      if ((event.key === 'Enter' || event.key === ' ') && isControl(event.target)) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'PageDown':
        case 'j':
          goTo(index() + 1);
          break;
        case 'ArrowUp':
        case 'PageUp':
        case 'k':
          goTo(index() - 1);
          break;
        case 'Home':
          goTo(0);
          break;
        case 'End':
          goTo(shorts().length - 1);
          break;
        case 'Enter':
        case ' ':
          play(current());
          break;
        case 'o': {
          const url = current()?.url;
          if (url) globalThis.open(url, '_blank', 'noopener,noreferrer');
          break;
        }
        case 'u': {
          const article = current();
          if (article) void setRead(article.id, !article.isRead);
          break;
        }
        default:
          return;
      }
      // Only reached when a case matched — ArrowDown and space would
      // otherwise scroll the container a second time, past the slide.
      event.preventDefault();
    };

    globalThis.addEventListener('keydown', onKeyDown);
    // In the component body, NOT an effect: a Solid 2 effect callback owns
    // no cleanup scope, so onCleanup there warns NO_OWNER_CLEANUP and the
    // listener outlives the route.
    onCleanup(() => globalThis.removeEventListener('keydown', onKeyDown));
  }

  return (
    <div class="flex h-full flex-col">
      {/* Outside the boundary: on screen the frame the navigation commits. */}
      <header class="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
        <h1 class="flex-1 text-lg font-semibold">Shorts</h1>
        <p class="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span>move</span>
          <Kbd>↵</Kbd>
          <span>play</span>
          <Kbd>o</Kbd>
          <span>open</span>
          <Kbd>u</Kbd>
          <span>unread</span>
        </p>
      </header>

      {/* `relative` so the prev/next controls are positioned once, over the
          scroller, rather than once per slide. */}
      <div class="relative min-h-0 flex-1 bg-muted/30">
        <Loading fallback={<ShortsSkeleton />}>
          <Show
            when={shorts().length > 0}
            fallback={
              <div class="grid h-full place-items-center px-6 text-center">
                <div class="max-w-sm">
                  <p class="text-sm text-muted-foreground">
                    No shorts yet. Subscribe to a YouTube channel and any
                    Shorts it posts land here instead of the inbox.
                  </p>
                  <Button
                    as="a"
                    href={paths.feeds()}
                    variant="outline"
                    size="sm"
                    class="mt-4"
                  >
                    Manage feeds
                  </Button>
                </div>
              </div>
            }
          >
            {/* Exactly the height left over, so there are no nested
                scrollbars fighting for the wheel. */}
            <div
              ref={(el) => (scroller = el)}
              onScroll={(event) => {
                const el = event.currentTarget;
                if (el.clientHeight > 0) {
                  focusIndex(Math.round(el.scrollTop / el.clientHeight));
                }
              }}
              class="h-full snap-y snap-mandatory overflow-y-auto"
            >
              <ul class="h-full">
                <For each={shorts()}>
                  {(article) => (
                    <Slide
                      article={article}
                      playing={playing() === article.id}
                      onPlay={() => play(article)}
                    />
                  )}
                </For>
              </ul>
            </div>

            {/*
              The same two moves the keyboard makes, and the only ones that
              work once the player has focus. `pointer-events-none` on the
              column so the strip beside the video is not a dead zone for the
              wheel; the buttons opt back in.
            */}
            <div class="pointer-events-none absolute inset-y-0 right-0 flex flex-col items-center justify-center gap-2 pr-4 sm:pr-8">
              <Button
                variant="outline"
                size="icon"
                class="pointer-events-auto rounded-full shadow-sm"
                aria-label="Previous short"
                disabled={index() === 0}
                onClick={() => goTo(index() - 1)}
              >
                {/* A bare glyph, not an icon element: ANY element child of
                    Button is an unclaimed node at hydration. */}
                ▲
              </Button>

              <span class="rounded-full bg-background/80 px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {index() + 1} / {shorts().length}
              </span>

              <Button
                variant="outline"
                size="icon"
                class="pointer-events-auto rounded-full shadow-sm"
                aria-label="Next short"
                disabled={index() >= shorts().length - 1}
                onClick={() => goTo(index() + 1)}
              >
                ▼
              </Button>
            </div>
          </Show>
        </Loading>
      </div>
    </div>
  );
}

/** The keycap in the header hint. Small enough to live next to its only use. */
function Kbd(props: { children?: JSX.Element }) {
  return (
    <kbd class="rounded border border-border bg-card px-1.5 py-0.5 font-sans text-[10px] leading-none text-foreground">
      {props.children}
    </kbd>
  );
}
