import {
  createEffect,
  createMemo,
  For,
  Loading,
  onCleanup,
  Repeat,
  Show,
} from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Title } from '@solidjs/meta';
import { useLocation } from '@solidjs/router';
import { env } from 'virtual:env/client';

import { AddFeedDialog } from './components/AddFeedDialog';
import type { FeedSummary } from './server/feeds/queries';
import { getFeeds, getShortsCount, getUnreadCount } from './lib/feeds';
import { paths, Router } from './router';
import { Skeleton } from './components/ui/skeleton';
import './app.css';

// The router sets `aria-current="page"` on claimed anchors that match the
// location exactly, and `data-active` on those that match OR are a prefix of
// it. Styling on `aria-current` rather than `data-active` on purpose:
// `data-active` would light "Manage feeds" up the whole time you are reading
// /feeds/3, since /feeds is its prefix.
//
// This costs nothing and is the most visible half of "the click landed" —
// the sidebar highlight moves on the same frame as the navigation, before
// any data for the new page exists.
const NAV_ACTIVE = 'aria-[current=page]:bg-accent';

const NAV_LINK = `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent ${NAV_ACTIVE}`;

/** A feed whose last fetch failed gets a marker rather than silent staleness. */
function FeedRow(props: { feed: FeedSummary }) {
  return (
    <a
      href={paths.feeds(props.feed.id)}
      class={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent aria-[current=page]:font-medium ${NAV_ACTIVE}`}
      title={props.feed.lastError ?? props.feed.title}
    >
      <Show
        when={props.feed.iconUrl}
        fallback={
          <span class="grid size-4 shrink-0 place-items-center rounded bg-muted text-[10px] font-semibold text-muted-foreground">
            {props.feed.title.slice(0, 1).toUpperCase()}
          </span>
        }
      >
        {(icon) => <img src={icon()} alt="" class="size-4 shrink-0 rounded" />}
      </Show>

      <span class="min-w-0 flex-1 truncate">{props.feed.title}</span>

      <Show when={props.feed.failureCount > 0}>
        <span
          class="shrink-0 font-bold text-destructive"
          aria-label={`Last fetch failed: ${props.feed.lastError}`}
        >
          !
        </span>
      </Show>
      <Show when={props.feed.unreadCount > 0}>
        <span class="shrink-0 text-xs tabular-nums text-muted-foreground">
          {props.feed.unreadCount}
        </span>
      </Show>
    </a>
  );
}

/** Stands in for FeedRow: same padding, same icon square, same text line. */
const FEED_SKELETON_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32', 'w-20'];

function FeedListSkeleton() {
  return (
    <div aria-hidden="true">
      <Repeat count={5}>
        {(index) => (
          <div class="flex items-center gap-2 px-2 py-1.5">
            <Skeleton class="size-4 shrink-0 rounded" />
            <Skeleton
              class={`h-3.5 ${FEED_SKELETON_WIDTHS[index % FEED_SKELETON_WIDTHS.length]}`}
            />
          </div>
        )}
      </Repeat>
    </div>
  );
}

/**
 * The app shell: sidebar plus the routed page.
 *
 * A separate component rendered INSIDE <Router>, for a reason that is not
 * cosmetic: `query()` reads the router context, so calling getFeeds() from
 * App's own body — outside the <Router> element — throws during SSR with a
 * context error whose stack points only at solid-js internals.
 *
 * The shell lives here rather than in a route layout file because a layout
 * file whose name matches a directory (routes/feeds.tsx next to
 * routes/feeds/) silently makes its own path unroutable.
 */
function Shell(props: { children?: JSX.Element }) {
  // Solid 2 has no createResource and no Suspense: an async computation IS
  // the primitive. Reading before it settles throws, and the nearest
  // <Loading> boundary catches that and renders its fallback.
  const feeds = createMemo(() => getFeeds());
  const unread = createMemo(() => getUnreadCount());
  const shorts = createMemo(() => getShortsCount());
  const location = useLocation();

  /**
   * Publish the route header's height as `--route-header-h` on <main>.
   *
   * ArticleList's day separators are sticky and have to park directly BELOW
   * the route header, which is itself sticky at the top of this same scroll
   * container. Two sticky elements in one container do not stack — the second
   * needs to know the first one's height.
   *
   * Measured rather than hardcoded because the headers genuinely differ: the
   * inbox's is one line, a feed's is two, and a feed whose last fetch failed
   * grows a third. A constant would be right on one route, wrong on the
   * others, and silently wrong again the first time a header gains a line.
   */
  // `ref={main}` assigns this at render time — the compiler rewrites the JSX,
  // so the linter cannot see the assignment.
  // oxlint-disable-next-line no-unassigned-vars
  let main: HTMLElement | undefined;
  let resize: ResizeObserver | undefined;
  let mutation: MutationObserver | undefined;
  let written = '';
  const observed = new WeakSet<Element>();

  const measure = (host: HTMLElement) => {
    const header = host.querySelector(':scope header');
    const value = `${header?.getBoundingClientRect().height ?? 0}px`;
    // Guarded because this also runs from a MutationObserver: without it,
    // every list re-render would force a synchronous layout for no change.
    if (value === written) return;
    written = value;
    host.style.setProperty('--route-header-h', value);
  };

  const retarget = (host: HTMLElement) => {
    const header = host.querySelector(':scope header');
    if (header && !observed.has(header)) {
      observed.add(header);
      resize?.observe(header);
    }
    measure(host);
  };

  // Solid 2 has no onMount; an effect keyed on the pathname runs after the
  // first render and after every navigation, which is when a new header
  // element needs finding. Effects do not run during SSR, so nothing below
  // touches the DOM on the server.
  createEffect(
    () => location.pathname,
    () => {
      const host = main;
      if (!host) return;

      // Catches a header that changes size in place: a feed error appearing,
      // or a long title rewrapping when the window narrows.
      resize ??= new ResizeObserver(() => measure(host));

      // And this catches a header that is not there YET. A navigation changes
      // the pathname BEFORE the new route commits its DOM, so the effect
      // above frequently runs while the old header is gone and the new one
      // has not arrived — measuring 0 and never correcting itself. Watching
      // for the element to appear is what makes the offset right on a route
      // whose header renders a frame later, or from under a Loading boundary.
      mutation ??= new MutationObserver(() => retarget(host));
      mutation.observe(host, { childList: true, subtree: true });

      retarget(host);
    },
  );

  onCleanup(() => {
    resize?.disconnect();
    mutation?.disconnect();
  });

  return (
    <div class="flex h-screen">
      <aside class="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div class="flex items-center justify-between gap-2 px-4 py-4">
          <a href={paths()} class="text-sm font-semibold">
            OpenFeeds
          </a>
          <AddFeedDialog />
        </div>

        <nav class="px-2">
          <a href={paths()} class={NAV_LINK}>
            <span class="flex-1">Inbox</span>
            {/* Its own boundary: a slow count must not blank the shell. */}
            <Loading fallback={null}>
              <Show when={unread() > 0}>
                <span class="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {unread()}
                </span>
              </Show>
            </Loading>
          </a>
          <a href={paths.shorts()} class={NAV_LINK}>
            <span class="flex-1">Shorts</span>
            {/* Its own boundary, for the same reason the inbox count has one. */}
            <Loading fallback={null}>
              <Show when={shorts() > 0}>
                <span class="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {shorts()}
                </span>
              </Show>
            </Loading>
          </a>
          <a href={paths.feeds()} class={NAV_LINK}>
            Manage feeds
          </a>
        </nav>

        <p class="px-4 pb-2 pt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Feeds
        </p>
        <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {/*
            No `on` prop, on purpose. This boundary should show its fallback
            once — on first paint — and then never again: after a feed is
            added or an article is read the sidebar revalidates, and Solid 2's
            default (hold the rendered content through the transition) is
            exactly right there. A blanking sidebar on every mark-as-read
            would be the worst version of this screen.
          */}
          <Loading fallback={<FeedListSkeleton />}>
            <Show
              when={feeds().length > 0}
              fallback={
                <p class="px-2 py-1.5 text-sm text-muted-foreground">
                  No feeds yet.
                </p>
              }
            >
              <For each={feeds()}>{(feed) => <FeedRow feed={feed} />}</For>
            </Show>
          </Loading>
        </div>
      </aside>

      <main ref={main} class="min-w-0 flex-1 overflow-y-auto">
        {/*
          `on` is the whole reason a click feels instant.

          A Loading boundary that has already rendered content does NOT go
          back to its fallback when its data goes pending again — it holds
          the content it has and lets the transition run underneath. That is
          the right default for revalidation, and the wrong one for
          navigation: it is why clicking a feed used to leave the previous
          page on screen until the new page's data arrived.

          Keyed on the pathname, the boundary notices the URL changed and
          drops to its fallback immediately, so the navigation commits on the
          first frame and each route paints its own chrome.

          The fallback is `null` and not a spinner because nothing should
          reach this boundary: every route below wraps its own async reads,
          and a fresh route component brings a fresh (uninitialised)
          boundary with it. This one is the backstop that keeps an
          unwrapped read from stalling the whole shell.
        */}
        <Loading fallback={null} on={location.pathname}>
          {props.children}
        </Loading>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      {(props) => (
        <>
          <Title>{env.VITE_APP_NAME}</Title>
          <Shell>{props.children}</Shell>
        </>
      )}
    </Router>
  );
}
