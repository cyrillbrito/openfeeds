// The image and duration chains, driven through normalizeFeed so that
// feedsmith's real per-format shapes are what gets exercised.
import { describe, expect, it } from 'vitest';

import { firstImageUrl, parseDuration } from './media';
import { normalizeFeed } from './normalize';

const FEED_URL = 'https://example.com/feed.xml';

const MEDIA_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
<channel>
  <title>Media Blog</title>
  <link>https://example.com</link>
  <item>
    <title>Thumbnails at several sizes</title>
    <link>https://example.com/one</link>
    <description>A post.</description>
    <media:thumbnail url="/small.jpg" width="120" height="68"/>
    <media:thumbnail url="https://cdn.example.com/large.jpg" width="1280" height="720"/>
  </item>
  <item>
    <title>A video item</title>
    <link>https://example.com/two</link>
    <description>Watch it.</description>
    <media:content url="https://cdn.example.com/clip.mp4" medium="video" duration="754"/>
  </item>
  <item>
    <title>An image-only item</title>
    <link>https://example.com/three</link>
    <description>Look.</description>
    <media:content url="https://cdn.example.com/photo.jpg" medium="image" width="900" height="600"/>
  </item>
</channel>
</rss>`;

const PODCAST = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>A Podcast</title>
  <link>https://example.com</link>
  <item>
    <title>Episode 4</title>
    <link>https://example.com/ep4</link>
    <description>Show notes go here.</description>
    <enclosure url="https://cdn.example.com/ep4.mp3" type="audio/mpeg" length="48000000"/>
    <itunes:duration>1:04:22</itunes:duration>
    <itunes:image href="https://cdn.example.com/art.jpg"/>
  </item>
</channel>
</rss>`;

const BODY_IMAGE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Plain Blog</title>
  <link>https://example.com</link>
  <item>
    <title>No media namespace anywhere</title>
    <link>https://example.com/post</link>
    <description>A teaser.</description>
    <content:encoded><![CDATA[<img src="https://feedburner.com/~ff/t.gif" width="1" height="1"><p>Body</p><img src="/hero.jpg">]]></content:encoded>
  </item>
</channel>
</rss>`;

const NOTE = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Microblog</title>
  <link rel="alternate" href="https://example.com/"/>
  <entry>
    <id>tag:example.com,2026:99</id>
    <link rel="alternate" href="https://example.com/notes/99"/>
    <content type="html">&lt;p&gt;A thought, with no title at all.&lt;/p&gt;</content>
    <published>2026-08-20T10:00:00Z</published>
  </entry>
</feed>`;

describe('media extraction — Media RSS', () => {
  const items = normalizeFeed(MEDIA_RSS, FEED_URL).items;

  it('picks the largest thumbnail, resolved against the feed', () => {
    expect(items[0].imageUrl).toBe('https://cdn.example.com/large.jpg');
  });

  it('reads a video medium and its duration', () => {
    expect(items[1].kind).toBe('video');
    expect(items[1].durationSeconds).toBe(754);
  });

  it('gives a video no excerpt even when the feed supplied a description', () => {
    expect(items[1].excerpt).toBeUndefined();
  });

  it('uses an image-medium content as the thumbnail', () => {
    expect(items[2].imageUrl).toBe('https://cdn.example.com/photo.jpg');
    expect(items[2].kind).toBe('article');
  });
});

describe('media extraction — podcast', () => {
  const [episode] = normalizeFeed(PODCAST, FEED_URL).items;

  it('classifies an audio enclosure as a podcast', () => {
    expect(episode.kind).toBe('podcast');
  });

  it('parses an hh:mm:ss iTunes duration', () => {
    expect(episode.durationSeconds).toBe(3862);
  });

  it('keeps the show notes — unlike video, they are worth reading', () => {
    expect(episode.excerpt).toBe('Show notes go here.');
  });
});

describe('media extraction — last resort', () => {
  const [post] = normalizeFeed(BODY_IMAGE, FEED_URL).items;

  it('takes an image out of the body, skipping the tracking pixel', () => {
    expect(post.imageUrl).toBe('https://example.com/hero.jpg');
  });
});

describe('media extraction — notes', () => {
  const [note] = normalizeFeed(NOTE, FEED_URL).items;

  it('classifies a titleless entry as a note', () => {
    expect(note.kind).toBe('note');
  });

  it("keeps the note's body as its excerpt — the row has nothing else", () => {
    // A note has no title, so the excerpt is the row's primary text rather
    // than a preview under one. Suppressing it would leave 'Untitled' alone.
    expect(note.excerpt).toBe('A thought, with no title at all.');
  });

  it('still substitutes a title, for anything that needs one', () => {
    expect(note.title).toBe('Untitled');
  });
});

describe('parseDuration', () => {
  it('reads all three shapes the iTunes spec allows', () => {
    expect(parseDuration('754')).toBe(754);
    expect(parseDuration('12:34')).toBe(754);
    expect(parseDuration('1:04:22')).toBe(3862);
    expect(parseDuration(754)).toBe(754);
  });

  it('rejects anything else rather than storing a NaN', () => {
    expect(parseDuration('about an hour')).toBeUndefined();
    expect(parseDuration('1:2:3:4')).toBeUndefined();
    expect(parseDuration(undefined)).toBeUndefined();
    expect(parseDuration(0)).toBeUndefined();
  });
});

describe('firstImageUrl', () => {
  const BASE = 'https://example.com/feed.xml';

  it('resolves a relative src against the feed', () => {
    expect(firstImageUrl('<img src="/img/hero.jpg">', BASE)).toBe(
      'https://example.com/img/hero.jpg',
    );
  });

  it('skips 1x1 tracking pixels', () => {
    // A counter pixel as the hero image is a visible bug, not a missing one.
    expect(
      firstImageUrl(
        '<img src="https://feeds.example/pixel.gif" width="1" height="1"><img src="/real.jpg">',
        BASE,
      ),
    ).toBe('https://example.com/real.jpg');
  });

  it('skips known counter hosts even at a normal size', () => {
    expect(
      firstImageUrl(
        '<img src="https://feedburner.com/~ff/track.gif"><img src="/real.jpg">',
        BASE,
      ),
    ).toBe('https://example.com/real.jpg');
  });

  it('skips data URIs — they would land in the SSR payload', () => {
    expect(
      firstImageUrl('<img src="data:image/gif;base64,R0lGOD"><img src="/real.jpg">', BASE),
    ).toBe('https://example.com/real.jpg');
  });

  it('is undefined when there is no image', () => {
    expect(firstImageUrl('<p>No pictures.</p>', BASE)).toBeUndefined();
    expect(firstImageUrl(null, BASE)).toBeUndefined();
  });
});
