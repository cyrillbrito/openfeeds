import { describe, expect, it } from 'vitest';

import { youtubeThumbnailUrl, youtubeVideoId } from './youtube';

describe('youtubeVideoId', () => {
  it('reads a watch link', () => {
    expect(youtubeVideoId('https://www.youtube.com/watch?v=Qtl8lJwbd4g')).toBe(
      'Qtl8lJwbd4g',
    );
  });

  it('reads the id when v= is not the first parameter', () => {
    expect(
      youtubeVideoId('https://www.youtube.com/watch?list=PLabc&v=Qtl8lJwbd4g'),
    ).toBe('Qtl8lJwbd4g');
  });

  it('reads share, embed and live links', () => {
    expect(youtubeVideoId('https://youtu.be/Qtl8lJwbd4g?t=42')).toBe(
      'Qtl8lJwbd4g',
    );
    expect(
      youtubeVideoId('https://www.youtube-nocookie.com/embed/Qtl8lJwbd4g'),
    ).toBe('Qtl8lJwbd4g');
    expect(youtubeVideoId('https://www.youtube.com/live/Qtl8lJwbd4g')).toBe(
      'Qtl8lJwbd4g',
    );
  });

  it('reads a Short too — one reader for every YouTube shape', () => {
    expect(youtubeVideoId('https://www.youtube.com/shorts/5mU6SRS2Bxo')).toBe(
      '5mU6SRS2Bxo',
    );
  });

  it('is null-safe and ignores non-YouTube links', () => {
    expect(youtubeVideoId('https://example.com/watch?v=Qtl8lJwbd4g')).toBe(null);
    expect(youtubeVideoId(null)).toBe(null);
    expect(youtubeVideoId('')).toBe(null);
  });
});

describe('youtubeThumbnailUrl', () => {
  it('uses hqdefault, the one size every video has', () => {
    expect(youtubeThumbnailUrl('Qtl8lJwbd4g')).toBe(
      'https://i.ytimg.com/vi/Qtl8lJwbd4g/hqdefault.jpg',
    );
  });
});
