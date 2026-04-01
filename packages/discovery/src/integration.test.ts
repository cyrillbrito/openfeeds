import { describe, expect, test } from 'bun:test';
import { discoverFeeds, SERVICES as services } from './server.js';

describe('RSS Discovery Integration', () => {
  test('should export main discovery function', () => {
    expect(typeof discoverFeeds).toBe('function');
  });

  test('should export individual services', () => {
    expect(typeof services.YoutubePlaylist).toBe('function');
    expect(typeof services.RedditSub).toBe('function');
    expect(typeof services.GithubRepo).toBe('function');
  });

  test('should discover Reddit feeds', async () => {
    const feeds = await discoverFeeds('https://www.reddit.com/r/javascript');
    expect(feeds).toHaveLength(1);
    expect(feeds[0].url).toBe('https://www.reddit.com/r/javascript.rss');
    expect(feeds[0].title).toBe('Subreddit Feed');
  });

  test('should discover GitHub feeds', async () => {
    const feeds = await discoverFeeds('https://github.com/microsoft/typescript');
    expect(feeds).toHaveLength(3);
    expect(feeds.map((f) => f.url)).toEqual([
      'https://github.com/microsoft/typescript/releases.atom',
      'https://github.com/microsoft/typescript/commits.atom',
      'https://github.com/microsoft/typescript/tags.atom',
    ]);
  });

  test('should discover YouTube channel feeds', async () => {
    const feeds = await discoverFeeds('https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(feeds).toHaveLength(1);
    expect(feeds[0].url).toBe(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw',
    );
    expect(feeds[0].title).toBe('UC_x5XG1OV2P6uZZ5FSM9Ttw');
  });

  test('should handle unknown URLs gracefully', async () => {
    const feeds = await discoverFeeds('https://unknown-service-that-does-not-exist.com');
    expect(feeds).toHaveLength(0);
  });

  test('should use individual service checkers', () => {
    const result = services.RedditSub('https://www.reddit.com/r/programming');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://www.reddit.com/r/programming.rss');
  });
});
