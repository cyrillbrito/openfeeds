/**
 * The normaliser against real feed documents, one per format.
 *
 * These are the cases that actually break feed readers: an item with no
 * <guid>, a summary that is a teaser while the real body sits in
 * content:encoded, an Atom entry whose link is relative, a date the
 * publisher invented. Each assertion below corresponds to a decision in
 * normalize.ts rather than to a field being copied across.
 */
import { describe, expect, it } from 'vitest';

import { normalizeFeed } from './normalize';

const FEED_URL = 'https://example.com/feed.xml';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Example Blog</title>
  <link>https://example.com</link>
  <description>Words about things</description>
  <image><url>https://example.com/logo.png</url></image>
  <item>
    <title>First Post</title>
    <link>https://example.com/first</link>
    <description>A teaser.</description>
    <content:encoded><![CDATA[<p>The <b>whole</b> post.</p>]]></content:encoded>
    <dc:creator>Ada Lovelace</dc:creator>
    <guid isPermaLink="false">stable-guid-1</guid>
    <pubDate>Tue, 02 Jan 2024 15:04:05 GMT</pubDate>
  </item>
  <item>
    <title>No Guid Post</title>
    <link>https://example.com/second</link>
    <description>This item omits guid entirely.</description>
    <pubDate>not a date at all</pubDate>
  </item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="text">Atom Blog</title>
  <subtitle>The subtitle</subtitle>
  <link rel="self" href="https://example.com/feed.xml"/>
  <link rel="alternate" type="text/html" href="https://example.com/"/>
  <icon>/icon.png</icon>
  <entry>
    <title>Atom Entry</title>
    <link rel="alternate" href="/relative-path"/>
    <id>tag:example.com,2026:1</id>
    <published>2026-01-02T10:00:00Z</published>
    <updated>2026-01-03T10:00:00Z</updated>
    <summary type="text">The summary</summary>
    <content type="html">&lt;p&gt;Body&lt;/p&gt;</content>
    <author><name>Grace Hopper</name></author>
  </entry>
</feed>`;

const JSON_FEED = JSON.stringify({
  version: 'https://jsonfeed.org/version/1.1',
  title: 'JSON Blog',
  home_page_url: 'https://example.com',
  icon: 'https://example.com/icon.png',
  items: [
    {
      id: 'json-1',
      url: 'https://example.com/json-post',
      title: 'JSON Post',
      summary: 'A summary',
      content_html: '<p>HTML body</p>',
      date_published: '2026-01-04T00:00:00Z',
      authors: [{ name: 'Alan Turing' }],
    },
  ],
});

describe('normalizeFeed — RSS', () => {
  const feed = normalizeFeed(RSS, FEED_URL);

  it('reads channel metadata', () => {
    expect(feed.title).toBe('Example Blog');
    expect(feed.description).toBe('Words about things');
    expect(feed.siteUrl).toBe('https://example.com/');
    expect(feed.iconUrl).toBe('https://example.com/logo.png');
  });

  it('prefers content:encoded over the description teaser', () => {
    // <description> is the teaser; content:encoded is the article. Getting
    // this backwards is why some readers show two sentences and a "read
    // more" for feeds that shipped the whole post.
    expect(feed.items[0].summary).toBe('A teaser.');
    expect(feed.items[0].content).toBe('<p>The <b>whole</b> post.</p>');
  });

  it('uses the feed-supplied guid as identity', () => {
    expect(feed.items[0].guid).toBe('stable-guid-1');
  });

  it('falls back to the link when an item has no guid', () => {
    // Without a fallback this item has no dedup key, so every sweep would
    // insert it again.
    expect(feed.items[1].guid).toBe('https://example.com/second');
  });

  it('reads dc:creator when there is no author element', () => {
    expect(feed.items[0].author).toBe('Ada Lovelace');
  });

  it('parses RFC 822 dates and discards unparseable ones', () => {
    expect(feed.items[0].publishedAt?.toISOString()).toBe(
      '2024-01-02T15:04:05.000Z',
    );
    // Undefined, NOT an Invalid Date — that would become NaN in SQLite.
    expect(feed.items[1].publishedAt).toBeUndefined();
  });
});

describe('normalizeFeed — Atom', () => {
  const feed = normalizeFeed(ATOM, FEED_URL);

  it('unwraps text constructs to their value', () => {
    expect(feed.title).toBe('Atom Blog');
    expect(feed.description).toBe('The subtitle');
    expect(feed.items[0].title).toBe('Atom Entry');
    expect(feed.items[0].summary).toBe('The summary');
  });

  it('picks the alternate link, not the self link', () => {
    // rel="self" is the feed document; rel="alternate" is the human page.
    expect(feed.siteUrl).toBe('https://example.com/');
  });

  it('resolves relative links against the feed URL', () => {
    expect(feed.items[0].url).toBe('https://example.com/relative-path');
    expect(feed.iconUrl).toBe('https://example.com/icon.png');
  });

  it('uses the entry id and prefers published over updated', () => {
    expect(feed.items[0].guid).toBe('tag:example.com,2026:1');
    expect(feed.items[0].publishedAt?.toISOString()).toBe(
      '2026-01-02T10:00:00.000Z',
    );
  });

  it('reads the author name', () => {
    expect(feed.items[0].author).toBe('Grace Hopper');
  });
});

describe('normalizeFeed — JSON Feed', () => {
  const feed = normalizeFeed(JSON_FEED, FEED_URL);

  it('maps JSON Feed onto the same shape', () => {
    expect(feed.title).toBe('JSON Blog');
    expect(feed.items[0]).toMatchObject({
      guid: 'json-1',
      title: 'JSON Post',
      url: 'https://example.com/json-post',
      author: 'Alan Turing',
      summary: 'A summary',
      content: '<p>HTML body</p>',
    });
  });
});

describe('normalizeFeed — hostile input', () => {
  it('throws on a document that is not a feed', () => {
    // An HTML error page served with a 200 is the common real-world case.
    // The caller turns this into a visible per-feed error.
    expect(() => normalizeFeed('<html><body>Nope</body></html>', FEED_URL)).toThrow();
  });

  it('handles a feed with no items', () => {
    const empty = `<rss version="2.0"><channel><title>Empty</title></channel></rss>`;
    expect(normalizeFeed(empty, FEED_URL).items).toEqual([]);
  });
});

/**
 * The shorts wiring, against the shape YouTube actually emits. The channel
 * feed mixes both kinds and distinguishes them by the alternate link alone —
 * `/shorts/<id>` against `/watch?v=<id>` — so this is the one place worth
 * checking with a real-looking document rather than a bare URL string.
 */
const YOUTUBE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <title>MrBeast</title>
  <link rel="alternate" href="https://www.youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA"/>
  <entry>
    <id>yt:video:5mU6SRS2Bxo</id>
    <title>A short</title>
    <link rel="alternate" href="https://www.youtube.com/shorts/5mU6SRS2Bxo"/>
    <published>2026-08-23T16:00:04+00:00</published>
  </entry>
  <entry>
    <id>yt:video:Qtl8lJwbd4g</id>
    <title>A regular video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=Qtl8lJwbd4g"/>
    <published>2026-08-20T16:00:04+00:00</published>
  </entry>
</feed>`;

describe('normalizeFeed — YouTube', () => {
  it('classifies a mixed channel feed by link shape', () => {
    const { items } = normalizeFeed(YOUTUBE, FEED_URL);
    expect(items.map((i) => [i.title, i.kind])).toEqual([
      ['A short', 'short'],
      ['A regular video', 'video'],
    ]);
  });

  it('derives a thumbnail from the link, with no media namespace present', () => {
    // The fixture carries no media:group at all — plenty of things that
    // syndicate YouTube strip it — so this is the id-in-the-URL path.
    expect(normalizeFeed(YOUTUBE, FEED_URL).items.map((i) => i.imageUrl)).toEqual([
      'https://i.ytimg.com/vi/5mU6SRS2Bxo/hqdefault.jpg',
      'https://i.ytimg.com/vi/Qtl8lJwbd4g/hqdefault.jpg',
    ]);
  });

  it('gives a video no excerpt', () => {
    // The whole point: YouTube's media:description is the entire description
    // box, and 200 characters of sponsor copy is worse than nothing.
    expect(
      normalizeFeed(YOUTUBE, FEED_URL).items.every((i) => i.excerpt === undefined),
    ).toBe(true);
  });
});

describe('normalizeFeed — kind', () => {
  it('defaults every ordinary titled entry to article', () => {
    expect(normalizeFeed(RSS, FEED_URL).items.every((i) => i.kind === 'article')).toBe(true);
    expect(normalizeFeed(ATOM, FEED_URL).items.every((i) => i.kind === 'article')).toBe(true);
    expect(
      normalizeFeed(JSON_FEED, FEED_URL).items.every((i) => i.kind === 'article'),
    ).toBe(true);
  });
});
