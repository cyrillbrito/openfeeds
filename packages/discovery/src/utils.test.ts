import { describe, expect, test } from 'bun:test';
import { isSupportedProtocol, parseUrl, resolveUrl, truncate } from './core/utils.js';

describe('URL Utilities', () => {
  describe('parseUrl', () => {
    test('should parse valid URLs', () => {
      const url = parseUrl('https://example.com/path?query=value#hash');
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('example.com');
      expect(url.pathname).toBe('/path');
      expect(url.search).toBe('?query=value');
      expect(url.hash).toBe('#hash');
    });

    test('should throw on invalid URLs', () => {
      expect(() => parseUrl('not-a-url')).toThrow();
    });
  });

  describe('resolveUrl', () => {
    test('should resolve absolute URLs', () => {
      const result = resolveUrl('https://example.com', 'https://other.com/feed');
      expect(result).toBe('https://other.com/feed');
    });

    test('should resolve protocol-relative URLs', () => {
      const result = resolveUrl('https://example.com', '//cdn.example.com/feed');
      expect(result).toBe('https://cdn.example.com/feed');
    });

    test('should resolve root-relative URLs', () => {
      const result = resolveUrl('https://example.com/blog/post', '/feed.xml');
      expect(result).toBe('https://example.com/feed.xml');
    });

    test('should resolve path-relative URLs', () => {
      const result = resolveUrl('https://example.com/blog/post/', 'feed.xml');
      expect(result).toBe('https://example.com/blog/post/feed.xml');
    });

    test('should resolve filename-relative URLs', () => {
      const result = resolveUrl('https://example.com/blog/post', 'feed.xml');
      expect(result).toBe('https://example.com/blog/feed.xml');
    });

    test('should handle complex relative paths', () => {
      const result = resolveUrl('https://example.com/blog/2023/', '../rss/feed.xml');
      expect(result).toBe('https://example.com/blog/rss/feed.xml');
    });
  });

  describe('isSupportedProtocol', () => {
    test('should support HTTP and HTTPS', () => {
      expect(isSupportedProtocol('http://example.com')).toBe(true);
      expect(isSupportedProtocol('https://example.com')).toBe(true);
    });

    test('should reject browser-specific protocols', () => {
      expect(isSupportedProtocol('chrome://settings')).toBe(false);
      expect(isSupportedProtocol('chrome-extension://id/page')).toBe(false);
      expect(isSupportedProtocol('about:blank')).toBe(false);
      expect(isSupportedProtocol('vivaldi://settings')).toBe(false);
      expect(isSupportedProtocol('edge://settings')).toBe(false);
      expect(isSupportedProtocol('devtools://devtools/page')).toBe(false);
    });

    test('should support other common protocols', () => {
      expect(isSupportedProtocol('ftp://files.example.com')).toBe(true);
      expect(isSupportedProtocol('file:///local/file')).toBe(true);
    });

    test('should handle invalid URLs', () => {
      expect(isSupportedProtocol('not-a-url')).toBe(false);
      expect(isSupportedProtocol('')).toBe(false);
    });
  });

  describe('truncate', () => {
    test('should not truncate short strings', () => {
      const result = truncate('short', 10);
      expect(result).toBe('short');
    });

    test('should truncate long strings in the middle', () => {
      const result = truncate('verylongstring', 10);
      expect(result).toBe('very...ing');
    });

    test('should use custom separator', () => {
      const result = truncate('verylongstring', 10, '---');
      expect(result).toBe('very---ing'); // 4 chars + 3 separator + 3 chars = 10
    });

    test('should handle edge cases', () => {
      expect(truncate('', 10)).toBe('');
      expect(truncate('a', 1)).toBe('a');
      expect(truncate('ab', 1, '...')).toBe('.'); // Separator too long, truncate separator
    });

    test('should distribute characters evenly', () => {
      const result = truncate('1234567890', 7, '...');
      expect(result).toBe('12...90'); // 2 chars + 3 dots + 2 chars = 7
    });

    test('should handle odd character distribution', () => {
      const result = truncate('123456789', 6, '..');
      expect(result).toBe('12..89'); // 2 chars + 2 dots + 2 chars = 6
    });
  });
});
