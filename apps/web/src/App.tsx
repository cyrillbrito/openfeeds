import { createMemo, For, Loading, Repeat, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Title } from '@solidjs/meta';
import { useLocation } from '@solidjs/router';
import { env } from 'virtual:env/client';

import { AddFeedDialog } from './components/AddFeedDialog';
import type { FeedSummary } from './server/feeds/queries';
import { getFeeds, getShortsCount, getUnreadCount } from './lib/feeds';
import { getUser, signOut } from './lib/auth-client';
import { paths, Router } from './router';
import { Skeleton } from './components/ui/skeleton';
import './app.css';

// `aria-current="page"` matches the location exactly; the router's
// `data-active` also matches prefixes, which would light "Manage feeds" up
// the whole time you are reading /feeds/3.
const NAV_ACTIVE = 'aria-[current=page]:bg-accent';

const NAV_LINK = `flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent ${NAV_ACTIVE}`;

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
 * Rendered INSIDE <Router> because `query()` reads router context — calling
 * getFeeds() from App's own body throws during SSR. It is not a route layout
 * file because a layout whose name matches a directory (routes/feeds.tsx
 * beside routes/feeds/) makes its own path unroutable.
 *
 * <main> does not scroll: each route is a fixed header plus its own
 * scroller, which is what lets ArticleList's day separators be `top-0`.
 */
function Shell(props: { children?: JSX.Element }) {
  // Solid 2 has no createResource and no Suspense: an async computation IS
  // the primitive. Reading before it settles throws, and the nearest
  // <Loading> boundary catches that and renders its fallback.
  const feeds = createMemo(() => getFeeds());
  const unread = createMemo(() => getUnreadCount());
  const shorts = createMemo(() => getShortsCount());
  const user = createMemo(() => getUser());
  const location = useLocation();

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
            No `on`: this should fall back on first paint and never again.
            Holding content through a revalidation is right here — a sidebar
            that blanks on every mark-as-read would be the worst version of
            this screen.
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

        <div class="flex items-center gap-2 border-t border-border px-4 py-3">
          <Loading fallback={<Skeleton class="h-3.5 w-32" />}>
            <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {user()?.email}
            </span>
          </Loading>
          {/*
            A full page load, not a client navigation: signing out has to
            drop every cached query, and the sign-in page is rendered
            without the shell that would refetch them.
          */}
          <button
            type="button"
            class="text-xs underline underline-offset-4 hover:text-foreground"
            onClick={async () => {
              await signOut();
              window.location.href = paths.signin();
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/*
          `on` is the whole reason a click feels instant: a boundary that has
          already rendered content holds it when its data goes pending again,
          which is right for revalidation and wrong for navigation. Keyed on
          the pathname it drops to its fallback the moment the URL changes.

          `null`, not a spinner — every route wraps its own reads, so this is
          only the backstop against an unwrapped one stalling the shell.
        */}
        <Loading fallback={null} on={location.pathname}>
          {props.children}
        </Loading>
      </main>
    </div>
  );
}

/**
 * The shell reads the signed-in user's feeds, so it cannot wrap the page
 * that exists for people who are not signed in: those reads redirect to
 * /signin, and /signin rendering them is a redirect loop.
 */
function Chrome(props: { children?: JSX.Element }) {
  const location = useLocation();
  return (
    <Show
      when={location.pathname !== paths.signin()}
      fallback={props.children}
    >
      <Shell>{props.children}</Shell>
    </Show>
  );
}

export default function App() {
  return (
    <Router>
      {(props) => (
        <>
          <Title>{env.VITE_APP_NAME}</Title>
          <Chrome>{props.children}</Chrome>
        </>
      )}
    </Router>
  );
}
