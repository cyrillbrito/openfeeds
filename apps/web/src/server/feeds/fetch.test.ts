// Conditional GET and URL canonicalisation. `fetch` is stubbed: these are
// about which headers go out and how the response is read, both
// deterministic.
import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalizeFeedUrl, fetchFeed } from './fetch';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Capture the Request the code under test makes. */
function stubFetch(response: Response) {
  const spy = vi.fn<(...args: unknown[]) => Promise<Response>>(
    async () => response,
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

function headersOf(spy: ReturnType<typeof stubFetch>) {
  const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
  return init.headers as Record<string, string>;
}

describe('fetchFeed — conditional GET', () => {
  it('sends no validators on a first fetch', () => {
    const spy = stubFetch(new Response('<rss/>', { status: 200 }));
    return fetchFeed('https://example.com/feed.xml').then(() => {
      const headers = headersOf(spy);
      expect(headers['if-none-match']).toBeUndefined();
      expect(headers['if-modified-since']).toBeUndefined();
    });
  });

  it('echoes back a stored ETag and Last-Modified', async () => {
    const spy = stubFetch(new Response('<rss/>', { status: 200 }));
    await fetchFeed('https://example.com/feed.xml', {
      etag: 'W/"abc123"',
      lastModified: 'Tue, 02 Jan 2024 15:04:05 GMT',
    });
    const headers = headersOf(spy);
    expect(headers['if-none-match']).toBe('W/"abc123"');
    expect(headers['if-modified-since']).toBe('Tue, 02 Jan 2024 15:04:05 GMT');
  });

  it('reports 304 as not-modified, with no body to parse', async () => {
    stubFetch(new Response(null, { status: 304 }));
    const result = await fetchFeed('https://example.com/feed.xml', {
      etag: 'W/"abc123"',
    });
    expect(result).toEqual({ status: 'not-modified' });
  });

  it('returns the validators the server sent, for next time', async () => {
    stubFetch(
      new Response('<rss/>', {
        status: 200,
        headers: {
          etag: 'W/"next"',
          'last-modified': 'Wed, 03 Jan 2024 00:00:00 GMT',
        },
      }),
    );
    const result = await fetchFeed('https://example.com/feed.xml');
    expect(result).toMatchObject({
      status: 'ok',
      etag: 'W/"next"',
      lastModified: 'Wed, 03 Jan 2024 00:00:00 GMT',
    });
  });
});

describe('fetchFeed — failure handling', () => {
  it('turns an HTTP error into a result, never a throw', async () => {
    stubFetch(new Response('nope', { status: 404, statusText: 'Not Found' }));
    const result = await fetchFeed('https://example.com/feed.xml');
    expect(result.status).toBe('error');
    expect(result).toHaveProperty('message', expect.stringContaining('404'));
  });

  it('turns a network throw into a result', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND dead.example.com');
    }));
    const result = await fetchFeed('https://dead.example.com/feed.xml');
    expect(result).toMatchObject({ status: 'error' });
  });

  it('rejects an empty 200 body', async () => {
    // A 200 with nothing in it is not "no new articles", it is broken.
    stubFetch(new Response('   ', { status: 200 }));
    expect((await fetchFeed('https://example.com/feed.xml')).status).toBe('error');
  });
});

describe('canonicalizeFeedUrl', () => {
  it('adds a scheme to what people actually paste', () => {
    expect(canonicalizeFeedUrl('example.com/feed.xml')).toBe(
      'https://example.com/feed.xml',
    );
  });

  it('lowercases scheme and host but not the path', () => {
    expect(canonicalizeFeedUrl('HTTPS://Example.COM/Feed.XML')).toBe(
      'https://example.com/Feed.XML',
    );
  });

  it('drops redundant default ports', () => {
    expect(canonicalizeFeedUrl('https://example.com:443/feed')).toBe(
      'https://example.com/feed',
    );
  });

  it('strips tracking parameters and fragments', () => {
    expect(
      canonicalizeFeedUrl('https://example.com/feed?utm_source=x&fbclid=y#top'),
    ).toBe('https://example.com/feed');
  });

  it('keeps parameters that select the document', () => {
    // Plenty of feeds are ?feed=rss or ?channel_id=... — dropping these
    // would point every feed on a host at the same URL.
    expect(canonicalizeFeedUrl('https://example.com/?feed=rss&cat=3')).toBe(
      'https://example.com/?feed=rss&cat=3',
    );
  });

  it('treats a bare host and a trailing slash as the same feed', () => {
    expect(canonicalizeFeedUrl('https://example.com/')).toBe(
      canonicalizeFeedUrl('https://example.com'),
    );
  });

  it('does NOT upgrade http to https', () => {
    // They can be served by different hosts. Merging two distinct feeds
    // silently loses a subscription; a duplicate row is merely untidy.
    expect(canonicalizeFeedUrl('http://example.com/feed')).toBe(
      'http://example.com/feed',
    );
  });
});
