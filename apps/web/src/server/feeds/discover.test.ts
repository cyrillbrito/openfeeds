// Resolution against a REAL HTTP server: discovery is almost entirely about
// how real responses behave — redirects, content types, 404s on stale links
// — so a mocked fetch would mostly assert that the mock works. The
// known-service table is pure string work and is tested as such.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { discoverFeeds, feedLinksIn, knownServiceFeeds } from './discover';

/** Path -> response, rebuilt per test. */
let routes = new Map<string, () => Response>();
/** Every path the server was asked for, in order. */
let hits: string[] = [];

const server = Bun.serve({
  port: 0,
  fetch(request: Request) {
    const url = new URL(request.url);
    hits.push(url.pathname + url.search);
    const handler = routes.get(url.pathname);
    return handler ? handler() : new Response('not found', { status: 404 });
  },
});

const base = `http://localhost:${server.port}`;

afterAll(() => server.stop(true));

beforeEach(() => {
  routes = new Map();
  hits = [];
});

function rss(title: string) {
  return `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>${title}</title><link>https://test.example</link>
  <description>Fixture</description>
  <item><title>One</title><guid>guid-1</guid></item>
</channel></rss>`;
}

const feed = (title: string) => () =>
  new Response(rss(title), {
    status: 200,
    headers: { 'content-type': 'application/rss+xml' },
  });

const page = (body: string) => () =>
  new Response(`<!doctype html><html>${body}</html>`, {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });

const link = (href: string, type = 'application/rss+xml', title = '') =>
  `<link rel="alternate" type="${type}"${title ? ` title="${title}"` : ''} href="${href}">`;

describe('discoverFeeds — the URL is already a feed', () => {
  it('subscribes to it directly, in one request', async () => {
    routes.set('/feed.xml', feed('Direct'));

    const result = await discoverFeeds(`${base}/feed.xml`);

    expect(result.status).toBe('feed');
    if (result.status !== 'feed') return;
    expect(result.url).toBe(`${base}/feed.xml`);
    // The body comes back so subscribing costs no second fetch.
    expect(result.body).toContain('<title>Direct</title>');
    expect(hits).toEqual(['/feed.xml']);
  });

  it('never rewrites a URL that is already a feed (v1 made r/x.rss into r/x.rss.rss)', async () => {
    // The service table would match `/r/solid`, so this proves the
    // is-it-already-a-feed check really does run first.
    routes.set('/r/solid.rss', feed('r/solid'));

    const result = await discoverFeeds(`${base}/r/solid.rss`);

    expect(result.status).toBe('feed');
    if (result.status !== 'feed') return;
    expect(result.url).toBe(`${base}/r/solid.rss`);
  });
});

describe('discoverFeeds — feeds advertised in the page', () => {
  it('resolves a homepage with one feed link, and returns that feed', async () => {
    routes.set('/', page(`<head>${link('/atom.xml')}</head>`));
    routes.set('/atom.xml', feed('The Blog'));

    const result = await discoverFeeds(base);

    expect(result.status).toBe('feed');
    if (result.status !== 'feed') return;
    expect(result.url).toBe(`${base}/atom.xml`);
  });

  it('offers a choice when the page advertises several', async () => {
    routes.set(
      '/',
      page(
        `<head>${link('/posts.xml', 'application/rss+xml', 'Posts')}${link('/comments.xml', 'application/atom+xml')}</head>`,
      ),
    );
    routes.set('/posts.xml', feed('Posts'));
    routes.set('/comments.xml', feed('Comments'));

    const result = await discoverFeeds(base);

    expect(result.status).toBe('candidates');
    if (result.status !== 'candidates') return;
    // Titles come from the feeds themselves, not from the link tags.
    expect(result.candidates.map((c) => c.title).sort()).toEqual([
      'Comments',
      'Posts',
    ]);
  });

  it('never offers a candidate it could not fetch and parse', async () => {
    // The classic stale <link>: the tag is there, the feed moved years ago.
    // v1 returned it unverified and created a permanently broken row.
    routes.set(
      '/',
      page(`<head>${link('/gone.xml')}${link('/live.xml')}</head>`),
    );
    routes.set('/live.xml', feed('Still Here'));

    const result = await discoverFeeds(base);

    // One survivor, so no pointless picker.
    expect(result.status).toBe('feed');
    if (result.status !== 'feed') return;
    expect(result.url).toBe(`${base}/live.xml`);
  });

  it('collapses the same feed published as both Atom and RSS', async () => {
    // What nearly every static-site generator emits. Two rows the user cannot
    // tell apart is a worse answer than not asking at all.
    routes.set(
      '/',
      page(
        `<head>${link('/atom.xml', 'application/atom+xml')}${link('/rss.xml')}</head>`,
      ),
    );
    routes.set(
      '/atom.xml',
      () =>
        new Response(
          `<?xml version="1.0"?>
           <feed xmlns="http://www.w3.org/2005/Atom">
             <title>Same Blog</title>
             <link href="https://test.example"/>
             <entry><title>One</title><id>guid-1</id></entry>
           </feed>`,
          { status: 200, headers: { 'content-type': 'application/atom+xml' } },
        ),
    );
    routes.set('/rss.xml', feed('Same Blog'));

    const result = await discoverFeeds(base);

    expect(result.status).toBe('feed');
    if (result.status !== 'feed') return;
    // The first one advertised wins — by convention that is the primary feed.
    expect(result.url).toBe(`${base}/atom.xml`);
  });

  it('still offers feeds that only share a title', async () => {
    // The guard against over-eager collapsing: a blog and its comments feed
    // often carry the same title and site link, but never the same items.
    routes.set(
      '/',
      page(`<head>${link('/a.xml')}${link('/b.xml')}</head>`),
    );
    routes.set('/a.xml', feed('Same Blog'));
    routes.set(
      '/b.xml',
      () =>
        new Response(
          rss('Same Blog').replace('guid-1', 'guid-2').replace('One', 'Two'),
          { status: 200, headers: { 'content-type': 'application/rss+xml' } },
        ),
    );

    const result = await discoverFeeds(base);
    expect(result.status).toBe('candidates');
  });

  it('deduplicates a feed advertised more than once', async () => {
    routes.set(
      '/',
      page(
        `<head>${link('/feed.xml')}${link('/feed.xml', 'application/rss+xml', 'Same again')}</head>`,
      ),
    );
    routes.set('/feed.xml', feed('Once'));

    const result = await discoverFeeds(base);

    expect(result.status).toBe('feed');
    // Deduped BEFORE fetching: the page fetch plus one verification.
    expect(hits.filter((h) => h === '/feed.xml')).toHaveLength(1);
  });
});

describe('feedLinksIn', () => {
  it('resolves relative hrefs against <base href>', async () => {
    const found = await feedLinksIn(
      `<head><base href="https://cdn.example.com/x/">${link('feed.xml')}</head>`,
      'https://example.com/page.html',
    );
    expect(found.map((f) => f.url)).toEqual(['https://cdn.example.com/x/feed.xml']);
  });

  it('ignores the WordPress REST API, which advertises itself as alternate JSON', async () => {
    const found = await feedLinksIn(
      `<head>${link('/wp-json/wp/v2/posts/1', 'application/json')}${link('/feed.json', 'application/feed+json')}</head>`,
      'https://example.com',
    );
    expect(found.map((f) => f.url)).toEqual(['https://example.com/feed.json']);
  });

  it('ignores alternate links that are not feed types', async () => {
    const found = await feedLinksIn(
      `<head>${link('/es/', 'text/html')}${link('/sitemap.xml', 'application/xml')}</head>`,
      'https://example.com',
    );
    expect(found).toEqual([]);
  });
});

describe('discoverFeeds — guessed paths', () => {
  it('falls back to common paths when the page advertises nothing', async () => {
    routes.set('/', page('<head><title>Silent</title></head>'));
    routes.set('/rss.xml', feed('Unadvertised'));

    const result = await discoverFeeds(base);

    expect(result.status).toBe('feed');
    if (result.status !== 'feed') return;
    expect(result.url).toBe(`${base}/rss.xml`);
  });

  it('asks the pasted section before the origin', async () => {
    routes.set('/blog/', page('<head><title>Section</title></head>'));
    routes.set('/blog/feed', feed('Section feed'));
    routes.set('/feed', feed('Site-wide feed'));

    const result = await discoverFeeds(`${base}/blog/`);

    expect(result.status).toBe('feed');
    if (result.status !== 'feed') return;
    expect(result.url).toBe(`${base}/blog/feed`);
    // Having found one under /blog it must not go on to probe the root.
    expect(hits).not.toContain('/feed');
  });

  it('gives up with a real message rather than inventing a feed', async () => {
    routes.set('/', page('<head><title>Nothing here</title></head>'));

    const result = await discoverFeeds(base);

    expect(result).toEqual({
      status: 'error',
      message: 'No feed found at that address',
    });
  });

  it('reports an unreachable address', async () => {
    const result = await discoverFeeds(`${base}/missing`);
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.message).toMatch(/404/);
  });

  it('rejects something that is not a URL at all', async () => {
    const result = await discoverFeeds('not a url');
    expect(result.status).toBe('error');
  });
});

describe('knownServiceFeeds', () => {
  it('derives a YouTube channel feed', () => {
    expect(knownServiceFeeds('https://www.youtube.com/channel/UC123')).toEqual([
      {
        url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC123',
        title: 'YouTube channel',
      },
    ]);
  });

  it('derives a YouTube playlist feed', () => {
    expect(
      knownServiceFeeds('https://www.youtube.com/playlist?list=PL9')[0]?.url,
    ).toBe('https://www.youtube.com/feeds/videos.xml?playlist_id=PL9');
  });

  it('leaves an @handle to the page itself, which advertises it correctly', () => {
    expect(knownServiceFeeds('https://www.youtube.com/@somebody')).toEqual([]);
  });

  it('offers all three GitHub repo feeds, since the page only advertises commits', () => {
    expect(
      knownServiceFeeds('https://github.com/solidjs/solid').map((f) => f.url),
    ).toEqual([
      'https://github.com/solidjs/solid/releases.atom',
      'https://github.com/solidjs/solid/commits.atom',
      'https://github.com/solidjs/solid/tags.atom',
    ]);
  });

  it('does not treat a deep GitHub path as a user (v1 produced issues.atom)', () => {
    expect(knownServiceFeeds('https://github.com/solidjs/solid/issues')).toEqual(
      [],
    );
  });

  it('handles a subreddit, including the old. host', () => {
    expect(knownServiceFeeds('https://old.reddit.com/r/solid')[0]?.url).toBe(
      'https://www.reddit.com/r/solid/.rss',
    );
  });

  it('claims nothing for an ordinary site (v1 matched anything containing /feed/)', () => {
    expect(knownServiceFeeds('https://example.com/feed/')).toEqual([]);
    expect(knownServiceFeeds('https://example.com/?p=1')).toEqual([]);
  });
});
