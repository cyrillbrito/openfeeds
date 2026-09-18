// The app's data layer: server functions the UI calls directly.
//
// Same shape as the scaffold's lib/users.ts — on the server these are plain
// calls; in the browser the compiler rewrites each into a typed fetch to
// /_server. `query()` caches reads by key; `action()` marks writes, and the
// router revalidates the queries when a write settles, so marking an article
// read updates the sidebar's unread count without a manual refetch.
import { action, query } from '@solidjs/router';
// `respond` and `reload` live in @solidjs/web, NOT @solidjs/router — they
// moved out in 2.0, and most material online still shows the old import.
import { reload, respond } from '@solidjs/web';

import { requireUserId } from '../server/require-user';
import { slowDown } from '../server/dev-delay';
import {
  countUnread,
  countUnreadShorts,
  getFeed,
  listArticles,
  listFeeds,
  markAllRead,
  setArticleArchived,
  setArticleRead,
} from '../server/feeds/queries';
import {
  subscribeToFeed,
  syncFeedNow,
  unsubscribeFromFeed,
  type SubscribeChoice,
} from '../server/feeds/sync';

// --- Reads ------------------------------------------------------------

export const getFeeds = query(async () => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  return listFeeds(userId);
}, 'feeds');

export const getInbox = query(async (unreadOnly: boolean) => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  // Shorts are excluded here and nowhere else: a channel that posts five a
  // day would otherwise bury every article in the inbox. They still show up
  // on their own feed's page, which is the screen that should be complete.
  return listArticles(userId, { unreadOnly, shorts: 'exclude' });
}, 'inbox');

/**
 * The shorts queue.
 *
 * Read shorts stay in the list rather than being filtered out, which is what
 * makes the viewer stable: playing one marks it read, that revalidates this
 * query, and if the filter dropped read items the video you are watching
 * would vanish from under the player. Instead the row dims and the queue
 * holds still. Newest first, so anything new lands at the top.
 */
export const getShorts = query(async () => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  return listArticles(userId, { shorts: 'only' });
}, 'shorts-queue');

export const getFeedArticles = query(async (feedId: number) => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  const [feed, items] = await Promise.all([
    getFeed(userId, feedId),
    listArticles(userId, { feedId }),
  ]);
  // A feed the user does not follow reads as one that does not exist.
  return { feed, items: feed ? items : [] };
}, 'feed-articles');

export const getUnreadCount = query(async () => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  return countUnread(userId);
}, 'unread-count');

export const getShortsCount = query(async () => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  return countUnreadShorts(userId);
}, 'shorts-count');

// --- Writes -----------------------------------------------------------

// Every mutation must say which caches it invalidated. A response with no
// revalidate list makes the router invalidate and refetch EVERY query in the
// cache, so the cheap thing (marking one article read) would refetch the
// article body, the feed list and the inbox for no reason.
//
// Matching is by PREFIX over `name + JSON.stringify(args)`, which is why the
// query names above are chosen not to be prefixes of one another — naming
// one 'feed' and another 'feeds' would make the first invalidate the second.

/** Anything that changes read/unread state moves these. */
const UNREAD_KEYS = [
  'feeds',
  'inbox',
  'unread-count',
  'feed-articles',
  // Neither of these prefixes the other, nor any name above — which the
  // prefix-matching rule makes load-bearing rather than cosmetic. A query
  // called 'shorts' would have invalidated both of them at once.
  'shorts-queue',
  'shorts-count',
];


/**
 * The three ways subscribing can end.
 *
 * Tagged rather than a boolean `ok`, because "we found several feeds, which
 * one?" is neither a success nor a failure — it is the middle of a
 * conversation, and the dialog renders a picker for it.
 */
export type AddFeedResult =
  | { status: 'added'; feedId: number; title: string }
  | { status: 'choose'; source: string; candidates: SubscribeChoice[] }
  | { status: 'error'; message: string };

/**
 * Subscribe to a feed.
 *
 * Returns a result object instead of throwing: a bad URL is an ordinary
 * outcome of a form, and the dialog needs the reason as a string to render
 * next to the input. Thrown errors are for bugs, not for typos.
 *
 * The `exact` field is set by the picker's submit. It means "this URL came
 * from a list we ourselves verified a moment ago", which lets the server skip
 * discovery instead of re-deriving an answer it already has.
 */
// The return type is left to inference: `respond()` wraps its argument in a
// ResponseEnvelope that the router unwraps again on the other side, so
// annotating this as AddFeedResult would be a lie in the middle and a
// mismatch at the boundary. AddFeedResult describes what the CALLER sees.
export const addFeed = action(async (formData: FormData) => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  const url = String(formData.get('url') ?? '').trim();
  if (!url) return { status: 'error', message: 'Enter a feed URL' };
  const exact = formData.get('exact') === '1';

  try {
    const outcome = await subscribeToFeed(userId, url, { exact });
    if (outcome.kind === 'choices') {
      // No revalidation: nothing was written, we are just asking a question.
      return { status: 'choose', source: url, candidates: outcome.candidates };
    }
    return respond(
      {
        status: 'added' as const,
        feedId: outcome.feed.id,
        title: outcome.feed.title,
      },
      { revalidate: UNREAD_KEYS },
    );
  } catch (error) {
    // Logged here because a plain thrown Error is sanitized to "Internal
    // Server Error" before it reaches the browser, and nothing else logs it.
    console.error('[addFeed]', error);
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Could not add that feed',
    };
  }
}, 'add-feed');

export const removeFeed = action(async (feedId: number) => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  await unsubscribeFromFeed(userId, feedId);
  return reload({ revalidate: UNREAD_KEYS });
}, 'remove-feed');

/** The manual refresh button — bypasses the schedule for one feed. */
export const refreshFeed = action(async (feedId: number) => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  // Only for a feed the user follows — the button must not become a way to
  // make the server fetch arbitrary rows.
  if (!(await getFeed(userId, feedId))) {
    return respond({ feedId, status: 'error' as const, inserted: 0 });
  }
  const result = await syncFeedNow(feedId);
  return respond(result ?? { feedId, status: 'error' as const, inserted: 0 }, {
    revalidate: UNREAD_KEYS,
  });
}, 'refresh-feed');

export const toggleRead = action(async (id: number, isRead: boolean) => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  await setArticleRead(userId, id, isRead);
  return reload({ revalidate: UNREAD_KEYS });
}, 'toggle-read');

export const archiveArticle = action(async (id: number) => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  await setArticleArchived(userId, id, true);
  return reload({ revalidate: UNREAD_KEYS });
}, 'archive-article');

export const markFeedRead = action(async (feedId?: number) => {
  'use server';
  const userId = await requireUserId();
  await slowDown();
  // No feed id means the inbox button, which must leave the shorts queue
  // alone — see markAllRead.
  await markAllRead(
    userId,
    feedId === undefined ? { shorts: 'exclude' } : { feedId },
  );
  return reload({ revalidate: UNREAD_KEYS });
}, 'mark-feed-read');
