// The sync engine: turn a due feed into new article rows, and decide when to
// look at it next.
//
// There is no job queue. `feeds.nextFetchAt` IS the queue — a sweep asks for
// rows whose time has come. Job state could only ever mirror the feeds table
// and then drift from it, so keeping the schedule on the row it describes is
// what makes this self-healing: a crash mid-sweep loses nothing, and a
// restart picks up exactly the feeds that are still due.
import 'server-only';

import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';

import { db } from '../db';
import { articles, feeds, type Feed } from '../db/schema';
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
 * Backoff in HOURS, not seconds.
 *
 * v1 retried within seconds and hid the failure. But RSS failures are almost
 * never transient — a dead domain, a feed that moved, a new Cloudflare rule —
 * so hammering a broken feed every minute accomplishes nothing except making
 * us look like a bad citizen to the host. Doubling from one hour reaches the
 * 24h ceiling after about five consecutive failures.
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
      // One body column: the teaser when there is one, the full body when
      // that is all the feed ships. Only the excerpt and the fallback
      // thumbnail read it — nothing renders it.
      summary: item.summary ?? item.content,
      kind: item.kind,
      // '' rather than NULL when there is no excerpt: NULL is reserved as
      // the "never enriched" marker the backfill scans for.
      excerpt: item.excerpt ?? '',
      imageUrl: item.imageUrl,
      imageWidth: item.imageWidth,
      imageHeight: item.imageHeight,
      durationSeconds: item.durationSeconds,
      enclosureUrl: item.enclosureUrl,
      // A feed that omits dates still needs to sort somewhere sensible.
      publishedAt: item.publishedAt ?? new Date(),
    }));

  if (rows.length === 0) return 0;

  // Re-fetching a feed re-sees every item it still lists, so almost all of
  // these collide with the unique(feedId, guid) index. That is the intended
  // path, not an error case — Postgres skips them and RETURNING reports
  // only the rows actually written.
  const inserted = await db
    .insert(articles)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: articles.id });

  return inserted.length;
}

/** Fetch one feed and record the outcome on its row. */
export async function syncFeed(feed: Feed): Promise<SyncResult> {
  const result = await fetchFeed(feed.feedUrl, {
    etag: feed.etag,
    lastModified: feed.lastModified,
  });

  if (result.status === 'error') {
    const failureCount = feed.failureCount + 1;
    await db
      .update(feeds)
      .set({
        failureCount,
        lastError: result.message,
        lastFetchedAt: new Date(),
        nextFetchAt: backoffFor(failureCount),
      })
      .where(eq(feeds.id, feed.id));
    return {
      feedId: feed.id,
      status: 'error',
      inserted: 0,
      error: result.message,
    };
  }

  if (result.status === 'not-modified') {
    // Reachable and unchanged — a success, and the cheapest kind.
    await db
      .update(feeds)
      .set({
        failureCount: 0,
        lastError: null,
        lastFetchedAt: new Date(),
        nextFetchAt: ms(BASE_INTERVAL_MS),
      })
      .where(eq(feeds.id, feed.id));
    return { feedId: feed.id, status: 'not-modified', inserted: 0 };
  }

  try {
    const parsed = normalizeFeed(result.body, feed.feedUrl);
    const inserted = await insertArticles(feed.id, parsed.items);

    await db
      .update(feeds)
      .set({
        // Feeds rename themselves; follow along, but never blank a good title.
        title: parsed.title || feed.title,
        description: parsed.description ?? feed.description,
        siteUrl: parsed.siteUrl ?? feed.siteUrl,
        iconUrl: parsed.iconUrl ?? feed.iconUrl,
        etag: result.etag ?? null,
        lastModified: result.lastModified ?? null,
        failureCount: 0,
        lastError: null,
        lastFetchedAt: new Date(),
        nextFetchAt: ms(BASE_INTERVAL_MS),
      })
      .where(eq(feeds.id, feed.id));

    return { feedId: feed.id, status: 'ok', inserted };
  } catch (error) {
    // Reachable but unparseable — an HTML error page served with a 200, say.
    // Same treatment as a network failure: back off and stay visible.
    const message =
      error instanceof Error ? error.message : 'Could not parse feed';
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
    return { feedId: feed.id, status: 'error', inserted: 0, error: message };
  }
}

/**
 * Sync every feed that is due, a few at a time.
 *
 * The concurrency cap is politeness as much as resource control: a burst of
 * simultaneous requests is what gets a self-hoster's IP rate-limited.
 */
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
 * Write the feed row and everything it currently lists.
 *
 * Takes the document rather than fetching it, because by the time we get here
 * discovery has already fetched and parsed it — re-requesting would double
 * every subscribe for no new information.
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

/**
 * Subscribe to whatever the user pasted.
 *
 * Two outcomes rather than one, because a homepage can legitimately offer
 * several feeds and picking for the user would be guessing. One feed
 * subscribes immediately; several come back as choices and the dialog asks.
 *
 * `exact` is the second half of that conversation: the user has chosen from
 * the picker, so the URL is known to be a feed and re-running discovery on it
 * would be a wasted round of requests.
 */
export async function subscribeToFeed(
  rawUrl: string,
  options: { exact?: boolean } = {},
): Promise<SubscribeOutcome> {
  let inputUrl: string;
  try {
    inputUrl = canonicalizeFeedUrl(rawUrl);
  } catch {
    throw new SubscribeError(`"${rawUrl}" is not a valid URL`);
  }

  // Re-pasting a feed already in the sidebar is a no-op worth naming, and
  // catching it here saves the network entirely.
  const existing = await findByUrl(inputUrl);
  if (existing) {
    throw new SubscribeError(`Already subscribed to ${existing.title}`);
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
      feed: await insertFeed(inputUrl, result.body, {
        etag: result.etag,
        lastModified: result.lastModified,
      }),
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
      throw new SubscribeError(`Already subscribed to ${alreadyHave.title}`);
    }
    return {
      kind: 'subscribed',
      feed: await insertFeed(discovery.url, discovery.body, {
        etag: discovery.etag,
        lastModified: discovery.lastModified,
      }),
    };
  }

  // Mark rather than filter: a page whose feeds you have all subscribed to
  // should say so, not present an empty list.
  const subscribed = new Set(
    (
      await db
        .select({ feedUrl: feeds.feedUrl })
        .from(feeds)
        .where(
          inArray(
            feeds.feedUrl,
            discovery.candidates.map((candidate) => candidate.url),
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

/** Unsubscribe. Articles go with it via the schema's cascade. */
export async function unsubscribeFromFeed(feedId: number): Promise<void> {
  await db.delete(feeds).where(eq(feeds.id, feedId));
}

/** Exposed for the "sync all" button and for the cron sweep's logging. */
export async function countDueFeeds(): Promise<number> {
  const [row] = await db
    // `::int` — count() is bigint, which arrives as a string otherwise.
    .select({ count: sql<number>`count(*)::int` })
    .from(feeds)
    .where(and(lte(feeds.nextFetchAt, new Date())));
  return row?.count ?? 0;
}
