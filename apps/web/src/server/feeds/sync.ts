// The write path: turn a due feed into new article rows, and decide when to
// look at it next. `feeds.nextFetchAt` is the queue — a sweep selects rows
// whose time has come, so a crash mid-sweep loses nothing.
import 'server-only';

import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';

import { db } from '../db';
import { articles, feeds, subscriptions, type Feed } from '../db/schema';
import { discoverFeeds } from './discover';
import { canonicalizeFeedUrl, fetchFeed } from './fetch';
import { normalizeFeed } from './normalize';

/** Nominal poll interval for a healthy feed. */
const BASE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
/** Ceiling for a persistently broken feed — try again tomorrow. */
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000; // 24 hours
/** How many feeds to fetch at once during a sweep. */
const CONCURRENCY = 6;

const ms = (n: number) => new Date(Date.now() + n);

/**
 * Backoff in hours. RSS failures are almost never transient — a dead domain,
 * a moved feed, a new Cloudflare rule — so retrying in seconds only makes us
 * a bad citizen. Doubling from one hour hits the ceiling after ~5 failures.
 */
function backoffFor(failureCount: number): Date {
  const delay = Math.min(
    BASE_INTERVAL_MS * 2 ** Math.max(0, failureCount - 1),
    MAX_BACKOFF_MS,
  );
  return ms(delay);
}

export interface SyncResult {
  feedId: number;
  status: 'ok' | 'not-modified' | 'error';
  /** New articles written. Zero is normal and healthy. */
  inserted: number;
  error?: string;
}

/** Write parsed items, ignoring ones this feed has already delivered. */
async function insertArticles(
  feedId: number,
  items: ReturnType<typeof normalizeFeed>['items'],
): Promise<number> {
  const rows = items
    .filter((item) => item.guid)
    .map((item) => ({
      feedId,
      guid: item.guid,
      title: item.title,
      url: item.url,
      author: item.author,
      // The teaser when there is one, the full body when that is all the
      // feed ships. Only the excerpt and fallback thumbnail read it.
      summary: item.summary ?? item.content,
      kind: item.kind,
      excerpt: item.excerpt ?? '',
      imageUrl: item.imageUrl,
      durationSeconds: item.durationSeconds,
      // A feed that omits dates still needs to sort somewhere sensible.
      publishedAt: item.publishedAt ?? new Date(),
    }));

  if (rows.length === 0) return 0;

  // Almost all of these collide with unique(feedId, guid) — the intended
  // path. RETURNING reports only the rows actually written.
  const inserted = await db
    .insert(articles)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: articles.id });

  return inserted.length;
}

type FeedMetadata = Partial<
  Pick<
    Feed,
    'title' | 'description' | 'siteUrl' | 'iconUrl' | 'etag' | 'lastModified'
  >
>;

async function recordSuccess(feed: Feed, metadata: FeedMetadata = {}) {
  await db
    .update(feeds)
    .set({
      ...metadata,
      failureCount: 0,
      lastError: null,
      lastFetchedAt: new Date(),
      nextFetchAt: ms(BASE_INTERVAL_MS),
    })
    .where(eq(feeds.id, feed.id));
}

async function recordFailure(feed: Feed, message: string) {
  const failureCount = feed.failureCount + 1;
  await db
    .update(feeds)
    .set({
      failureCount,
      lastError: message,
      lastFetchedAt: new Date(),
      nextFetchAt: backoffFor(failureCount),
    })
    .where(eq(feeds.id, feed.id));
}

/** Fetch one feed and record the outcome on its row. */
export async function syncFeed(feed: Feed): Promise<SyncResult> {
  const result = await fetchFeed(feed.feedUrl, {
    etag: feed.etag,
    lastModified: feed.lastModified,
  });

  if (result.status === 'error') {
    await recordFailure(feed, result.message);
    return {
      feedId: feed.id,
      status: 'error',
      inserted: 0,
      error: result.message,
    };
  }

  if (result.status === 'not-modified') {
    await recordSuccess(feed);
    return { feedId: feed.id, status: 'not-modified', inserted: 0 };
  }

  try {
    const parsed = normalizeFeed(result.body, feed.feedUrl);
    const inserted = await insertArticles(feed.id, parsed.items);

    await recordSuccess(feed, {
      // Feeds rename themselves; follow along, but never blank a good title.
      title: parsed.title || feed.title,
      description: parsed.description ?? feed.description,
      siteUrl: parsed.siteUrl ?? feed.siteUrl,
      iconUrl: parsed.iconUrl ?? feed.iconUrl,
      etag: result.etag ?? null,
      lastModified: result.lastModified ?? null,
    });

    return { feedId: feed.id, status: 'ok', inserted };
  } catch (error) {
    // Reachable but unparseable — an HTML error page served with a 200, say.
    // Treated as a network failure: back off and stay visible.
    const message =
      error instanceof Error ? error.message : 'Could not parse feed';
    await recordFailure(feed, message);
    return { feedId: feed.id, status: 'error', inserted: 0, error: message };
  }
}

/** The concurrency cap is politeness: a burst is what gets an IP blocked. */
export async function syncDueFeeds(): Promise<SyncResult[]> {
  const due = await db
    .select()
    .from(feeds)
    .where(lte(feeds.nextFetchAt, new Date()))
    .orderBy(asc(feeds.nextFetchAt));

  const results: SyncResult[] = [];
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    const batch = due.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map(syncFeed))));
  }
  return results;
}

/** Force a sync of one feed regardless of schedule (the UI's refresh button). */
export async function syncFeedNow(feedId: number): Promise<SyncResult | null> {
  const [feed] = await db.select().from(feeds).where(eq(feeds.id, feedId));
  return feed ? syncFeed(feed) : null;
}

export class SubscribeError extends Error {}

/** One row of the picker the dialog shows when a page offers several feeds. */
export interface SubscribeChoice {
  url: string;
  title: string;
  /** Already in the sidebar — the picker disables it rather than hiding it. */
  alreadySubscribed: boolean;
}

export type SubscribeOutcome =
  | { kind: 'subscribed'; feed: Feed }
  | { kind: 'choices'; candidates: SubscribeChoice[] };

/**
 * Write the feed row and everything it currently lists. Takes the document
 * rather than fetching it: discovery has already fetched and parsed it.
 */
async function insertFeed(
  feedUrl: string,
  body: string,
  validators: { etag?: string; lastModified?: string },
): Promise<Feed> {
  let parsed: ReturnType<typeof normalizeFeed>;
  try {
    parsed = normalizeFeed(body, feedUrl);
  } catch {
    throw new SubscribeError('That URL did not return a feed we understand');
  }

  const [feed] = await db
    .insert(feeds)
    .values({
      feedUrl,
      title: parsed.title,
      description: parsed.description,
      siteUrl: parsed.siteUrl,
      iconUrl: parsed.iconUrl,
      etag: validators.etag,
      lastModified: validators.lastModified,
      lastFetchedAt: new Date(),
      nextFetchAt: ms(BASE_INTERVAL_MS),
    })
    .returning();

  await insertArticles(feed.id, parsed.items);
  return feed;
}

/** The feed row for a canonical URL, if we already have one. */
async function findByUrl(feedUrl: string): Promise<Feed | undefined> {
  const [existing] = await db
    .select()
    .from(feeds)
    .where(eq(feeds.feedUrl, feedUrl));
  return existing;
}

async function isSubscribed(userId: string, feedId: number): Promise<boolean> {
  const [row] = await db
    .select({ feedId: subscriptions.feedId })
    .from(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.feedId, feedId)),
    );
  return row !== undefined;
}

/**
 * Point a user at an existing feed row, or throw if they already follow it.
 * The second subscriber to a feed costs one row and no network request.
 */
async function subscribe(userId: string, feed: Feed): Promise<Feed> {
  if (await isSubscribed(userId, feed.id)) {
    throw new SubscribeError(`Already subscribed to ${feed.title}`);
  }
  await db.insert(subscriptions).values({ userId, feedId: feed.id });
  return feed;
}

/**
 * Subscribe to whatever the user pasted. Two outcomes: one feed subscribes
 * immediately, several come back as choices and the dialog asks.
 *
 * `exact` means the URL came from that picker, so it is known to be a feed
 * and discovery would be a wasted round of requests.
 */
export async function subscribeToFeed(
  userId: string,
  rawUrl: string,
  options: { exact?: boolean } = {},
): Promise<SubscribeOutcome> {
  let inputUrl: string;
  try {
    inputUrl = canonicalizeFeedUrl(rawUrl);
  } catch {
    throw new SubscribeError(`"${rawUrl}" is not a valid URL`);
  }

  // Someone already follows this URL, so the feed and its articles are
  // already here: subscribing is one row and no network at all.
  const existing = await findByUrl(inputUrl);
  if (existing) {
    return { kind: 'subscribed', feed: await subscribe(userId, existing) };
  }

  if (options.exact) {
    const result = await fetchFeed(inputUrl);
    if (result.status === 'error') {
      throw new SubscribeError(`Could not fetch that feed — ${result.message}`);
    }
    if (result.status === 'not-modified') {
      // Impossible without validators, but the type demands a branch.
      throw new SubscribeError('Feed returned no content');
    }
    return {
      kind: 'subscribed',
      feed: await subscribe(
        userId,
        await insertFeed(inputUrl, result.body, {
          etag: result.etag,
          lastModified: result.lastModified,
        }),
      ),
    };
  }

  const discovery = await discoverFeeds(inputUrl);

  if (discovery.status === 'error') {
    throw new SubscribeError(discovery.message);
  }

  if (discovery.status === 'feed') {
    // Discovery follows redirects and canonicalises, so the URL it resolved
    // to can differ from the one we checked above — check the resolved one.
    const alreadyHave = await findByUrl(discovery.url);
    if (alreadyHave) {
      return { kind: 'subscribed', feed: await subscribe(userId, alreadyHave) };
    }
    return {
      kind: 'subscribed',
      feed: await subscribe(
        userId,
        await insertFeed(discovery.url, discovery.body, {
          etag: discovery.etag,
          lastModified: discovery.lastModified,
        }),
      ),
    };
  }

  // Mark rather than filter: a page whose feeds you have all subscribed to
  // should say so, not present an empty list.
  const subscribed = new Set(
    (
      await db
        .select({ feedUrl: feeds.feedUrl })
        .from(feeds)
        .innerJoin(subscriptions, eq(subscriptions.feedId, feeds.id))
        .where(
          and(
            eq(subscriptions.userId, userId),
            inArray(
              feeds.feedUrl,
              discovery.candidates.map((candidate) => candidate.url),
            ),
          ),
        )
    ).map((row) => row.feedUrl),
  );

  return {
    kind: 'choices',
    candidates: discovery.candidates.map((candidate) => ({
      url: candidate.url,
      title: candidate.title,
      alreadySubscribed: subscribed.has(candidate.url),
    })),
  };
}

/**
 * Unsubscribe one user, and drop the feed itself once nobody is left — which
 * cascades to its articles and keeps the fetch queue to feeds people read.
 */
export async function unsubscribeFromFeed(
  userId: string,
  feedId: number,
): Promise<void> {
  await db
    .delete(subscriptions)
    .where(
      and(eq(subscriptions.userId, userId), eq(subscriptions.feedId, feedId)),
    );

  // The id is a parameter, not a correlation to the outer `feeds` row:
  // Drizzle renders columns unqualified inside a single-table subquery, and
  // `subscriptions` has no `id` column for `feeds.id` to be mistaken for.
  await db.delete(feeds).where(
    and(
      eq(feeds.id, feedId),
      sql`not exists (select 1 from ${subscriptions} where ${subscriptions.feedId} = ${feedId})`,
    ),
  );
}
