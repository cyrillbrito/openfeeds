import { describe, expect, it } from 'vitest';

import { shortEmbedUrl, youtubeShortId } from './shorts';

describe('youtubeShortId', () => {
  it('reads the id out of a Shorts link', () => {
    expect(youtubeShortId('https://www.youtube.com/shorts/5mU6SRS2Bxo')).toBe(
      '5mU6SRS2Bxo',
    );
  });

  it('accepts the host variants a share link can carry', () => {
    expect(youtubeShortId('https://youtube.com/shorts/5mU6SRS2Bxo')).toBe(
      '5mU6SRS2Bxo',
    );
    expect(youtubeShortId('http://m.youtube.com/shorts/5mU6SRS2Bxo?t=3')).toBe(
      '5mU6SRS2Bxo',
    );
  });

  it('rejects a watch link — that is the whole distinction', () => {
    expect(youtubeShortId('https://www.youtube.com/watch?v=Qtl8lJwbd4g')).toBe(
      null,
    );
  });

  it('will not match /shorts/ appearing anywhere but the path', () => {
    expect(youtubeShortId('https://example.com/x?u=youtube.com/shorts/abc')).toBe(
      null,
    );
  });

  it('is null-safe — plenty of feed items have no link at all', () => {
    expect(youtubeShortId(null)).toBe(null);
    expect(youtubeShortId(undefined)).toBe(null);
    expect(youtubeShortId('')).toBe(null);
  });
});

describe('shortEmbedUrl', () => {
  it('points at the no-cookie player', () => {
    expect(shortEmbedUrl('5mU6SRS2Bxo')).toContain(
      'https://www.youtube-nocookie.com/embed/5mU6SRS2Bxo',
    );
  });
});
