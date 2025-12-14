import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { discoverFeeds } from './discovery.js';

// Mock fetch for testing
const mockFetch = mock();
(global as any).fetch = mockFetch;

describe('RSS Feed Discovery', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  test('should reject unsupported protocols', async () => {
    expect(discoverFeeds('chrome://settings')).rejects.toThrow('Unsupported protocol');
    expect(discoverFeeds('about:blank')).rejects.toThrow('Unsupported protocol');
  });

  test('should discover feeds from known services', async () => {
    const result = await discoverFeeds('https://www.reddit.com/r/programming');
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://www.reddit.com/r/programming.rss');
    expect(result[0].title).toBe('Subreddit Feed');
  });

  test('should discover feeds from HTML link tags', async () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="alternate" type="application/rss+xml" title="Site RSS" href="/feed.xml">
        <link rel="alternate" type="application/atom+xml" title="Site Atom" href="/atom.xml">
        <link rel="stylesheet" href="/style.css">
      </head>
      <body>Content</body>
      </html>
    `;

    // First call is for self RSS feed check (should fail)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    // Second call is for HTML content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const result = await discoverFeeds('https://example.com');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      url: 'https://example.com/feed.xml',
      title: 'Site RSS',
      type: 'application/rss+xml',
    });
    expect(result[1]).toEqual({
      url: 'https://example.com/atom.xml',
      title: 'Site Atom',
      type: 'application/atom+xml',
    });
  });

  test('should resolve relative URLs correctly', async () => {
    const htmlContent = `
      <html>
      <head>
        <link rel="alternate" type="application/rss+xml" href="/feed">
        <link rel="alternate" type="application/atom+xml" href="//cdn.example.com/atom.xml">
        <link rel="alternate" type="application/rss+xml" href="rss.xml">
        <link rel="alternate" type="application/atom+xml" href="https://external.com/feed">
      </head>
      </html>
    `;

    // First call is for self RSS feed check (should fail)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    // Second call is for HTML content
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const result = await discoverFeeds('https://example.com/blog/');

    expect(result).toHaveLength(4);
    expect(result.map((f) => f.url)).toEqual([
      'https://example.com/feed',
      'https://cdn.example.com/atom.xml',
      'https://example.com/blog/rss.xml',
      'https://external.com/feed',
    ]);
  });

  test('should try common feed paths as fallback', async () => {
    // First call for self RSS feed check fails
    mockFetch.mockRejectedValueOnce(new Error('Self feed check failed'));
    // Second call fails (no HTML parsing)
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch HTML'));

    // Mock responses for common paths - most fail, one succeeds
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }); // /feed
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 }); // /feed/
    mockFetch.mockResolvedValueOnce({
      // /rss - success!
      ok: true,
      status: 200,
      text: async () =>
        '<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title></channel></rss>',
      headers: { get: () => 'application/rss+xml' },
    });

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/rss');
    expect(result[0].title).toBe('https://example.com/rss');
  });

  test('should handle fetch errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(0);
  });

  test('should handle empty HTML gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '',
    });

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(0);
  });

  test('should respect custom options', async () => {
    const htmlContent =
      '<html><head><link rel="alternate" type="application/rss+xml" href="/feed"></head></html>';

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const options = {
      timeout: 5000,
      userAgent: 'CustomBot/1.0',
      followRedirects: false,
    };

    await discoverFeeds('https://example.com', options);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': 'CustomBot/1.0',
        }),
        redirect: 'manual',
      }),
    );
  });

  test('should filter out non-RSS link types', async () => {
    const htmlContent = `
      <html>
      <head>
        <link rel="stylesheet" type="text/css" href="style.css">
        <link rel="icon" type="image/png" href="favicon.png">
        <link rel="alternate" type="application/rss+xml" href="/feed.xml">
        <link type="text/javascript" href="script.js">
      </head>
      </html>
    `;

    // Self RSS check fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    // HTML content fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('application/rss+xml');
  });

  test('should validate XML content in fallback paths', async () => {
    // Self RSS check fails
    mockFetch.mockRejectedValueOnce(new Error('Self feed check failed'));
    // HTML fetch fails
    mockFetch.mockRejectedValueOnce(new Error('HTML fetch failed'));

    // Mock invalid XML response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '<html><body>Not XML</body></html>',
      headers: { get: () => null },
    });

    // Mock valid RSS response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Test</title></feed>',
      headers: { get: () => 'application/atom+xml' },
    });

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/feed/');
  });

  test('should support JSON feeds in HTML links', async () => {
    const htmlContent = `
      <html>
      <head>
        <link rel="alternate" type="application/json" href="/feed.json" title="JSON Feed">
        <link rel="alternate" type="application/feed+json" href="/feed2.json" title="JSON Feed 2">
      </head>
      </html>
    `;

    // Self RSS check fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    // HTML content fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('application/json');
    expect(result[1].type).toBe('application/feed+json');
  });

  test('should validate JSON feed content in fallback paths', async () => {
    // Self RSS check fails
    mockFetch.mockRejectedValueOnce(new Error('Self feed check failed'));
    // HTML fetch fails
    mockFetch.mockRejectedValueOnce(new Error('HTML fetch failed'));

    // Mock invalid JSON response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '{"not": "a feed"}',
      headers: { get: () => 'application/json' },
    });

    // Mock valid JSON feed response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          version: 'https://jsonfeed.org/version/1',
          title: 'Test Feed',
          items: [{ id: '1', content_text: 'Test item' }],
        }),
      headers: { get: () => 'application/feed+json' },
    });

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/feed/');
  });

  test('should skip URLs with invalid extensions', async () => {
    const htmlContent = `
      <html>
      <head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml">
        <link rel="alternate" type="application/rss+xml" href="/image.jpg">
        <link rel="alternate" type="application/rss+xml" href="/style.css">
        <link rel="alternate" type="application/rss+xml" href="/script.js">
      </head>
      </html>
    `;

    // Self RSS check fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    // HTML content fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const result = await discoverFeeds('https://example.com');

    // Should only include the valid feed URL, not the image/css/js files
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/feed.xml');
  });

  test('should skip URLs with WordPress admin patterns', async () => {
    const htmlContent = `
      <html>
      <head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml">
        <link rel="alternate" type="application/rss+xml" href="/wp-admin/feed.xml">
        <link rel="alternate" type="application/rss+xml" href="/wp-includes/feed.xml">
      </head>
      </html>
    `;

    // Self RSS check fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    // HTML content fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const result = await discoverFeeds('https://example.com');

    // Should only include the valid feed URL, not the wp-admin/wp-includes URLs
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/feed.xml');
  });

  // New tests for RSSHub-inspired features
  test('should detect when URL itself is an RSS feed', async () => {
    const rssContent = `<?xml version="1.0"?>
    <rss version="2.0">
      <channel>
        <title>Test RSS Feed</title>
        <description>A test feed</description>
      </channel>
    </rss>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => rssContent,
      headers: { get: () => 'application/rss+xml' },
    });

    const result = await discoverFeeds('https://example.com/feed.xml');

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://example.com/feed.xml');
    expect(result[0].title).toBe('Test RSS Feed');
    expect(result[0].type).toBe('application/rss+xml');
  });

  test('should handle feed: protocol links', async () => {
    const htmlContent = `
      <html>
      <body>
        <a href="feed://example.com/rss.xml" title="RSS Feed">Subscribe to RSS</a>
        <a href="feed:https://blog.example.com/atom.xml">Blog Feed</a>
      </body>
      </html>
    `;

    // Self RSS check fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    // HTML content fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(2);
    // The order may vary based on discovery method, just check both feeds are found
    const urls = result.map((r) => r.url);
    expect(urls).toContain('https://example.com/rss.xml');
    expect(urls).toContain('https://blog.example.com/atom.xml');

    // Check titles are properly extracted
    const rssFeed = result.find((r) => r.url === 'https://example.com/rss.xml');
    const atomFeed = result.find((r) => r.url === 'https://blog.example.com/atom.xml');
    // Priority is: title attribute > link text > default
    expect(rssFeed.title).toBe('RSS Feed'); // has title attribute
    expect(atomFeed.title).toBe('Blog Feed'); // uses link text
  });

  test('should discover feeds using heuristic patterns', async () => {
    const htmlContent = `
      <html>
      <body>
        <a href="/feed" class="rss-link">RSS</a>
        <a href="/blog/rss.xml" title="Blog RSS Feed">Blog RSS</a>
        <a href="/news/atom" class="feed-link">News Feed</a>
        <a href="/regular-page">Regular Link</a>
      </body>
      </html>
    `;

    // Self RSS check fails
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    // HTML content fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => htmlContent,
    });

    const result = await discoverFeeds('https://example.com');

    expect(result).toHaveLength(3);
    expect(result[0].url).toBe('https://example.com/feed');
    expect(result[0].title).toBe('RSS');
    expect(result[1].url).toBe('https://example.com/blog/rss.xml');
    expect(result[1].title).toBe('Blog RSS');
    expect(result[2].url).toBe('https://example.com/news/atom');
    expect(result[2].title).toBe('News Feed');
  });

  test('should handle CDATA sections in feed titles', async () => {
    const rssContent = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[Test & RSS Feed]]></title>
    <description>A test feed</description>
  </channel>
</rss>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => rssContent,
      headers: { get: () => 'application/rss+xml' },
    });

    const result = await discoverFeeds('https://example.com/feed.xml');

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Test & RSS Feed');
  });
});
