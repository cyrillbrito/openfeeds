// The pipeline end to end against a REAL HTTP server and a REAL database: a
// Bun.serve instance plays the feed publisher, so the 304 branch is chosen
// by an actual 304 rather than by a mock.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

process.env.DATABASE_URL = 'memory://';

const { db } = await import('../db');
const { articles, articleState, feeds, subscriptions, user } = await import(
  '../db/schema'
);
const { subscribeToFeed, syncFeedNow, unsubscribeFromFeed } = await import(
  './sync'
);

const ALICE = 'user_alice';
const BOB = 'user_bob';

/**
 * Subscribing now has two outcomes — one feed, or a list to choose from.
 * These tests are about the sync pipeline, so they assert the single-feed
 * outcome and unwrap it; the picker branch has its own suite below.
 */
async function subscribe(url: string, userId = ALICE) {
  const outcome = await subscribeToFeed(userId, url);
  if (outcome.kind !== 'subscribed') {
    throw new Error(`Expected a subscription, got ${outcome.candidates.length} choices`);
  }
  return outcome.feed;
}

/** Feed state the test server serves; mutated per test. */
let feedBody = '';
let etag = 'v1';
/** Every request the server saw, so we can assert on what we sent. */
let requests: Array<Record<string, string>> = [];

const server = Bun.serve({
  port: 0,
  fetch(request: Request) {
    const headers: Record<string, string> = {};
    request.headers.forEach((value: string, key: string) => {
      headers[key] = value;
    });
    requests.push(headers);

    const { pathname } = new URL(request.url);

    // A site advertising two feeds, for the picker branch.
    if (pathname === '/two-feeds.html') {
      return new Response(
        `<!doctype html><head>
           <link rel="alternate" type="application/rss+xml" href="/feed.xml">
           <link rel="alternate" type="application/rss+xml" href="/other.xml">
         </head>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      );
    }
    if (pathname === '/other.xml') {
      return new Response(rss(ITEM_TWO).replace('Test Feed', 'Other Feed'), {
        status: 200,
        headers: { 'content-type': 'application/rss+xml' },
      });
    }

    // Only these paths exist. Everything else 404s — which matters now that
    // subscribing runs discovery: a fixture that served a feed at every path
    // would make the guessed-path fallback "find" six of them.
    if (pathname !== '/feed.xml' && pathname !== '/page.html') {
      return new Response('nope', { status: 404 });
    }

    // The conditional-GET contract, implemented for real.
    if (request.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { etag } });
    }
    return new Response(feedBody, {
      status: 200,
      headers: { 'content-type': 'application/rss+xml', etag },
    });
  },
});

const base = `http://localhost:${server.port}`;

afterAll(() => server.stop(true));

function rss(items: string) {
  return `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Test Feed</title><link>https://test.example</link>
  <description>Fixture</description>
  ${items}
</channel></rss>`;
}

const ITEM_ONE = `<item><title>One</title><link>https://test.example/1</link>
  <guid>guid-1</guid><pubDate>Mon, 01 Jan 2024 10:00:00 GMT</pubDate></item>`;
const ITEM_TWO = `<item><title>Two</title><link>https://test.example/2</link>
  <guid>guid-2</guid><pubDate>Tue, 02 Jan 2024 10:00:00 GMT</pubDate></item>`;

beforeEach(async () => {
  await db.delete(articleState);
  await db.delete(subscriptions);
  await db.delete(articles);
  await db.delete(feeds);
  await db.delete(user);
  await db.insert(user).values([
    { id: ALICE, name: 'Alice', email: 'alice@example.com' },
    { id: BOB, name: 'Bob', email: 'bob@example.com' },
  ]);
  feedBody = rss(ITEM_ONE);
  etag = 'v1';
  requests = [];
});

describe('subscribeToFeed', () => {
  it('validates by fetching, then stores the feed and its articles', async () => {
    const feed = await subscribe(`${base}/feed.xml`);

    expect(feed.title).toBe('Test Feed');
    expect(feed.siteUrl).toBe('https://test.example/');
    expect(feed.etag).toBe('v1');

    const stored = await db.select().from(articles);
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('One');
  });

  it('canonicalises the URL it stores', async () => {
    const feed = await subscribe(`${base}/feed.xml?utm_source=twitter`);
    expect(feed.feedUrl).toBe(`${base}/feed.xml`);
  });

  it('refuses a duplicate subscription', async () => {
    await subscribe(`${base}/feed.xml`);
    // Same feed, different tracking params — must resolve to the same row.
    await expect(
      subscribe(`${base}/feed.xml?utm_campaign=x`),
    ).rejects.toThrow(/Already subscribed/);
  });

  it('rescues a dead feed URL by finding the one the site still serves', async () => {
    // Feeds move. The pasted address 404s, but discovery's guessed paths find
    // /feed.xml — which beats telling the user "404" and leaving it there.
    const feed = await subscribe(`${base}/404`);
    expect(feed.feedUrl).toBe(`${base}/feed.xml`);
  });

  it('reports an unreachable host instead of storing a broken row', async () => {
    // `.invalid` is reserved by RFC 2606 and must never resolve, so no stage
    // of discovery can find anything to fall back to.
    await expect(
      subscribe('https://openfeeds-test.invalid/feed.xml'),
    ).rejects.toThrow(/Could not reach/);
    expect(await db.select().from(feeds)).toHaveLength(0);
  });

  it('reuses the existing feed row for a second subscriber', async () => {
    const feed = await subscribe(`${base}/feed.xml`);
    requests = [];

    const again = await subscribe(`${base}/feed.xml`, BOB);

    // Same global feed, no second fetch, no duplicate articles.
    expect(again.id).toBe(feed.id);
    expect(requests).toHaveLength(0);
    expect(await db.select().from(feeds)).toHaveLength(1);
    expect(await db.select().from(articles)).toHaveLength(1);
    expect(await db.select().from(subscriptions)).toHaveLength(2);
  });

  it('refuses the same feed twice for the same user', async () => {
    await subscribe(`${base}/feed.xml`);
    await expect(subscribe(`${base}/feed.xml`)).rejects.toThrow(
      /Already subscribed/,
    );
  });

  it('asks which one when a page advertises several', async () => {
    const outcome = await subscribeToFeed(ALICE, `${base}/two-feeds.html`);

    expect(outcome.kind).toBe('choices');
    if (outcome.kind !== 'choices') return;
    expect(outcome.candidates.map((c) => c.title).sort()).toEqual([
      'Other Feed',
      'Test Feed',
    ]);
    // Asking is not subscribing — nothing was written.
    expect(await db.select().from(feeds)).toHaveLength(0);
  });

  it('marks choices already in the sidebar rather than hiding them', async () => {
    await subscribe(`${base}/feed.xml`);

    const outcome = await subscribeToFeed(ALICE, `${base}/two-feeds.html`);
    if (outcome.kind !== 'choices') throw new Error('expected choices');

    const seen = outcome.candidates.find((c) => c.title === 'Test Feed');
    expect(seen?.alreadySubscribed).toBe(true);
    const fresh = outcome.candidates.find((c) => c.title === 'Other Feed');
    expect(fresh?.alreadySubscribed).toBe(false);
  });

  it('subscribes to a picked choice without rediscovering it', async () => {
    const outcome = await subscribeToFeed(ALICE, `${base}/other.xml`, {
      exact: true,
    });

    expect(outcome.kind).toBe('subscribed');
    if (outcome.kind !== 'subscribed') return;
    expect(outcome.feed.title).toBe('Other Feed');
    // `exact` means exactly one request: no page fetch, no verification pass.
    expect(requests).toHaveLength(1);
  });

  it('refuses a URL that is not a feed', async () => {
    feedBody = '<html><body>Not a feed</body></html>';
    await expect(subscribe(`${base}/page.html`)).rejects.toThrow(
      'No feed found at that address',
    );
    expect(await db.select().from(feeds)).toHaveLength(0);
  });
});

describe('syncFeed', () => {
  it('sends the stored ETag and takes the 304 path', async () => {
    const feed = await subscribe(`${base}/feed.xml`);
    requests = [];

    const result = await syncFeedNow(feed.id);

    expect(requests[0]['if-none-match']).toBe('v1');
    expect(result).toMatchObject({ status: 'not-modified', inserted: 0 });
  });

  it('inserts only genuinely new items when the feed changes', async () => {
    const feed = await subscribe(`${base}/feed.xml`);

    // The feed now lists both items — item one is unchanged and must not
    // be inserted twice.
    feedBody = rss(ITEM_ONE + ITEM_TWO);
    etag = 'v2';

    const result = await syncFeedNow(feed.id);

    expect(result).toMatchObject({ status: 'ok', inserted: 1 });
    const titles = (await db.select().from(articles)).map((a) => a.title).sort();
    expect(titles).toEqual(['One', 'Two']);
  });

  it('records the error and backs off in hours when a feed breaks', async () => {
    const feed = await subscribe(`${base}/feed.xml`);
    const before = Date.now();

    // Point the stored row at the 404 path to simulate a feed going away.
    const { eq } = await import('drizzle-orm');
    await db
      .update(feeds)
      .set({ feedUrl: `${base}/404`, etag: null })
      .where(eq(feeds.id, feed.id));

    const result = await syncFeedNow(feed.id);
    expect(result?.status).toBe('error');

    const [broken] = await db.select().from(feeds);
    expect(broken.failureCount).toBe(1);
    expect(broken.lastError).toMatch(/404/);
    // Backoff is measured in hours, not seconds — the whole point of the
    // change from v1's retry behaviour.
    const delayMs = broken.nextFetchAt.getTime() - before;
    expect(delayMs).toBeGreaterThanOrEqual(59 * 60 * 1000);
  });

  it('clears the error state once a feed recovers', async () => {
    const feed = await subscribe(`${base}/feed.xml`);
    const { eq } = await import('drizzle-orm');
    await db
      .update(feeds)
      .set({ failureCount: 3, lastError: 'HTTP 500' })
      .where(eq(feeds.id, feed.id));

    feedBody = rss(ITEM_ONE + ITEM_TWO);
    etag = 'v2';
    await syncFeedNow(feed.id);

    const [recovered] = await db.select().from(feeds);
    expect(recovered.failureCount).toBe(0);
    expect(recovered.lastError).toBeNull();
  });
});

describe('unsubscribeFromFeed', () => {
  it('takes the feed articles with it once nobody is left', async () => {
    const feed = await subscribe(`${base}/feed.xml`);
    expect(await db.select().from(articles)).toHaveLength(1);

    await unsubscribeFromFeed(ALICE, feed.id);

    expect(await db.select().from(feeds)).toHaveLength(0);
    // Cascade, which only works because db/index.ts turns foreign keys on.
    expect(await db.select().from(articles)).toHaveLength(0);
  });

  it('keeps the feed while another subscriber remains', async () => {
    const feed = await subscribe(`${base}/feed.xml`);
    await subscribe(`${base}/feed.xml`, BOB);

    await unsubscribeFromFeed(ALICE, feed.id);

    expect(await db.select().from(feeds)).toHaveLength(1);
    expect(await db.select().from(articles)).toHaveLength(1);
    expect(await db.select().from(subscriptions)).toHaveLength(1);
  });
});
