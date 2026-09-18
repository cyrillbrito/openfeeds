/**
 * The excerpt deriver, against the three things that made the old
 * client-side `toPlainText` produce bad previews: raw entities, publisher
 * boilerplate eating the budget, and a cut landing mid-word.
 */
import { describe, expect, it } from 'vitest';

import {
  deriveExcerpt,
  firstImageUrl,
  htmlToText,
  isLinkOnly,
  stripBoilerplate,
  truncate,
} from './excerpt';

describe('htmlToText', () => {
  it('drops tags and gives block closers a space', () => {
    expect(htmlToText('<p>One</p><p>Two</p>')).toBe('One Two');
  });

  it('removes script and style bodies rather than just their tags', () => {
    expect(htmlToText('<style>.a{color:red}</style><p>Body</p>')).toBe('Body');
    expect(htmlToText('<script>var x = 1;</script><p>Body</p>')).toBe('Body');
  });

  it('decodes entities in one pass, so &amp;lt; stays literal', () => {
    // The chained-replace bug: decoding &amp; first turns this into '<'.
    expect(htmlToText('<p>Write &amp;lt; for a tag</p>')).toBe(
      'Write &lt; for a tag',
    );
  });

  it('decodes numeric and hex references', () => {
    expect(htmlToText('caf&#233; &#x2014; open')).toBe('café — open');
  });

  it('is empty for empty input', () => {
    expect(htmlToText(null)).toBe('');
    expect(htmlToText(undefined)).toBe('');
  });
});

describe('stripBoilerplate', () => {
  it('drops the WordPress tail', () => {
    expect(
      stripBoilerplate(
        'The real sentence. The post A short list of SQLite gotchas appeared first on Julia Evans.',
      ),
    ).toBe('The real sentence.');
  });

  it('drops stacked furniture in one call', () => {
    expect(
      stripBoilerplate(
        'The real sentence. The post Hello appeared first on Blog. Continue reading →',
      ),
    ).toBe('The real sentence.');
  });

  it('leaves "read more" alone when it is part of a sentence', () => {
    const text = 'You can read more about the read more problem here today.';
    expect(stripBoilerplate(text)).toBe(text);
  });
});

describe('truncate', () => {
  it('returns short text untouched', () => {
    expect(truncate('Short enough.', 100)).toBe('Short enough.');
  });

  it('prefers a sentence boundary', () => {
    const text = 'First sentence here. Second sentence runs on and on and on.';
    expect(truncate(text, 40)).toBe('First sentence here.');
  });

  it('falls back to a word boundary, never mid-word', () => {
    // A 30-character window ends inside "expialidocious"; the cut retreats to
    // the space before it rather than producing "...expialido…".
    const text = 'Supercalifragilistic expialidocious antidisestablishmentarian';
    expect(truncate(text, 30)).toBe('Supercalifragilistic…');
  });

  it('hard-cuts only when there is no boundary to retreat to', () => {
    expect(truncate('Antidisestablishmentarianismxx', 12)).toBe('Antidisestab…');
  });

  it('does not honour a sentence boundary that lands too early', () => {
    // "Hi." at character 3 would otherwise become the whole excerpt.
    const result = truncate('Hi. Then a much longer body that keeps going on.', 30);
    expect(result).not.toBe('Hi.');
  });
});

describe('deriveExcerpt', () => {
  it('falls through to content when summary is empty', () => {
    // The case the old list missed entirely: a feed that ships an empty
    // <description> and the real body in content:encoded showed no preview.
    expect(deriveExcerpt('', '<p>The body.</p>')).toBe('The body.');
    expect(deriveExcerpt(null, '<p>The body.</p>')).toBe('The body.');
  });

  it('prefers summary when there is one', () => {
    expect(deriveExcerpt('<p>Teaser.</p>', '<p>Whole body.</p>')).toBe('Teaser.');
  });

  it('is undefined when nothing survives, so the column stays NULL', () => {
    expect(deriveExcerpt(null, null)).toBeUndefined();
    expect(deriveExcerpt('<p></p>', '')).toBeUndefined();
  });

  it('cleans, strips and cuts in one go', () => {
    const summary =
      '<p>SQLite&#39;s <code>INTEGER PRIMARY KEY</code> is not what you think it is, ' +
      'and neither is its type system. Here are the five that bit me most often, in ' +
      'the order I hit them.</p><p>The post Gotchas appeared first on Julia Evans.</p>';
    const result = deriveExcerpt(summary, null)!;

    expect(result).toContain("SQLite's INTEGER PRIMARY KEY");
    expect(result).not.toContain('appeared first on');
    expect(result).not.toContain('<');
    expect(result.length).toBeLessThanOrEqual(201);
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

describe('isLinkOnly', () => {
  it('recognises the Hacker News shape', () => {
    // HN's entire <description> is a link to the comments page, which used to
    // put the word "Comments" under every row in the inbox.
    expect(isLinkOnly('<a href="https://news.ycombinator.com/item?id=1">Comments</a>')).toBe(
      true,
    );
  });

  it('keeps a real summary that merely ends in a link', () => {
    expect(
      isLinkOnly('<p>A real sentence. <a href="/more">Read more</a></p>'),
    ).toBe(false);
  });

  it('is false for no body at all — that is absent, not link-only', () => {
    expect(isLinkOnly('')).toBe(false);
    expect(isLinkOnly(null)).toBe(false);
  });

  it('makes deriveExcerpt skip the link-only source and fall through', () => {
    expect(deriveExcerpt('<a href="/c">Comments</a>', '<p>The body.</p>')).toBe(
      'The body.',
    );
    expect(deriveExcerpt('<a href="/c">Comments</a>', null)).toBeUndefined();
  });
});
