import { describe, expect, it } from 'vitest';

import { classifyItem, excerptLimitFor, showsExcerpt } from './article-kind';

describe('classifyItem', () => {
  it('checks Shorts before video — a Short is a video with its own screen', () => {
    expect(
      classifyItem({
        url: 'https://www.youtube.com/shorts/5mU6SRS2Bxo',
        hasVideo: true,
        feedTitle: 'A short',
      }),
    ).toBe('short');
  });

  it('calls an ordinary YouTube link a video, from the URL alone', () => {
    expect(
      classifyItem({
        url: 'https://www.youtube.com/watch?v=Qtl8lJwbd4g',
        feedTitle: 'A regular video',
      }),
    ).toBe('video');
  });

  it('calls a media:content video a video on any host', () => {
    expect(
      classifyItem({
        url: 'https://vimeo.com/123456',
        hasVideo: true,
        feedTitle: 'A talk',
      }),
    ).toBe('video');
  });

  it('prefers video over audio — a soundtrack is not a podcast', () => {
    expect(
      classifyItem({ hasVideo: true, hasAudio: true, feedTitle: 'Episode 4' }),
    ).toBe('video');
  });

  it('calls an audio enclosure a podcast', () => {
    expect(classifyItem({ hasAudio: true, feedTitle: 'Episode 4' })).toBe(
      'podcast',
    );
  });

  it('calls a titleless entry a note', () => {
    expect(classifyItem({ url: 'https://mastodon.example/@x/1' })).toBe('note');
    expect(classifyItem({ feedTitle: '   ' })).toBe('note');
  });

  it('does NOT call a short-bodied article a note', () => {
    // The rejected heuristic. Plenty of ordinary posts ship a one-line
    // <description>, and rendering those as bodyless notes looks broken.
    expect(classifyItem({ feedTitle: 'Hi', url: 'https://example.com/hi' })).toBe(
      'article',
    );
  });

  it('falls back to article for anything unrecognised', () => {
    expect(
      classifyItem({ url: 'https://example.com/posts/hello', feedTitle: 'Hello' }),
    ).toBe('article');
  });
});

describe('showsExcerpt', () => {
  it('suppresses the preview only for video, whose description is junk', () => {
    expect(showsExcerpt('video')).toBe(false);
    expect(showsExcerpt('short')).toBe(false);
    expect(showsExcerpt('article')).toBe(true);
    expect(showsExcerpt('podcast')).toBe(true);
  });

  it('keeps it for a note, whose excerpt IS its body', () => {
    expect(showsExcerpt('note')).toBe(true);
  });
});

describe('excerptLimitFor', () => {
  it('gives a note a longer budget — it is the row, not a preview', () => {
    expect(excerptLimitFor('note')).toBe(400);
    expect(excerptLimitFor('article')).toBeUndefined();
  });
});
