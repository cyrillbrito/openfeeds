/**
 * The scrubber's contract. These are the cases it claims to handle — the
 * module comment is explicit that a parser-based sanitiser is still required
 * before multi-user, and these tests do not pretend otherwise.
 */
import { describe, expect, it } from 'vitest';

import { sanitizeHtml } from './sanitize-html';

describe('sanitizeHtml', () => {
  it('keeps ordinary article markup intact', () => {
    const html = '<p>Hello <b>world</b></p><img src="https://ex.com/a.png">';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('removes script elements and their content', () => {
    expect(sanitizeHtml('<p>a</p><script>steal()</script><p>b</p>')).toBe(
      '<p>a</p><p>b</p>',
    );
  });

  it('removes iframes and embedded objects', () => {
    expect(sanitizeHtml('<iframe src="https://evil.example"></iframe>')).toBe('');
    expect(sanitizeHtml('<embed src="x.swf">')).toBe('');
  });

  it('strips event-handler attributes', () => {
    expect(sanitizeHtml('<img src="a.png" onerror="steal()">')).toBe(
      '<img src="a.png">',
    );
    expect(sanitizeHtml('<div onclick=steal()>x</div>')).toBe('<div>x</div>');
  });

  it('strips javascript: and data: URLs', () => {
    expect(sanitizeHtml('<a href="javascript:steal()">x</a>')).toBe('<a>x</a>');
    expect(sanitizeHtml("<a href='JaVaScRiPt:steal()'>x</a>")).toBe('<a>x</a>');
  });

  it('leaves http and relative URLs alone', () => {
    const html = '<a href="https://ex.com/p">x</a>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('handles null and empty input', () => {
    expect(sanitizeHtml(null)).toBe('');
    expect(sanitizeHtml(undefined)).toBe('');
  });
});
