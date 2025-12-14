import { describe, expect, test } from 'bun:test';
import {
  checkKnownServices,
  getGithubRepoRss,
  getGithubUserRss,
  getGitlabRepoRss,
  getGitlabUserRss,
  getItchioRss,
  getKickstarterRss,
  getMediumTagRss,
  getMirrorXyzRss,
  getRedditPostCommentsRss,
  getRedditRootRss,
  getRedditSubRss,
  getRedditUserRss,
  getVimeoRss,
  getWordPressRss,
  getYoutubePlaylistRss,
  getYoutubeRss,
} from './services.js';

describe('YouTube RSS Discovery', () => {
  test('should detect YouTube channel URL', () => {
    const result = getYoutubeRss('https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe(
      'https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw',
    );
  });

  test('should detect YouTube user URL', () => {
    const result = getYoutubeRss('https://www.youtube.com/user/GoogleDevelopers');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe(
      'https://www.youtube.com/feeds/videos.xml?user=GoogleDevelopers',
    );
  });

  test('should detect YouTube c/ URL', () => {
    const result = getYoutubeRss('https://www.youtube.com/c/GoogleDevelopers');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe(
      'https://www.youtube.com/feeds/videos.xml?user=GoogleDevelopers',
    );
  });

  test('should not match non-YouTube URLs', () => {
    const result = getYoutubeRss('https://example.com');
    expect(result.match).toBe(false);
    expect(result.feeds).toHaveLength(0);
  });
});

describe('YouTube Playlist RSS Discovery', () => {
  test('should detect YouTube playlist URL', () => {
    const result = getYoutubePlaylistRss(
      'https://www.youtube.com/playlist?list=PLrAXtmRdnEQy6nuLMt8SxUE71cXvRs14z',
    );
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe(
      'https://www.youtube.com/feeds/videos.xml?playlist_id=PLrAXtmRdnEQy6nuLMt8SxUE71cXvRs14z',
    );
  });

  test('should not match non-playlist URLs', () => {
    const result = getYoutubePlaylistRss('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result.match).toBe(false);
  });
});

describe('Reddit RSS Discovery', () => {
  test('should detect Reddit root URL', () => {
    const result = getRedditRootRss('https://www.reddit.com/');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://www.reddit.com/.rss');
  });

  test('should detect subreddit URL', () => {
    const result = getRedditSubRss('https://www.reddit.com/r/programming');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://www.reddit.com/r/programming.rss');
  });

  test('should detect Reddit user URL', () => {
    const result = getRedditUserRss('https://www.reddit.com/user/spez');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://www.reddit.com/user/spez.rss');
  });

  test('should detect Reddit post comments URL', () => {
    const result = getRedditPostCommentsRss(
      'https://www.reddit.com/r/programming/comments/abc123/title/',
    );
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe(
      'https://www.reddit.com/r/programming/comments/abc123/title.rss',
    );
  });
});

describe('GitHub RSS Discovery', () => {
  test('should detect GitHub repository URL', () => {
    const result = getGithubRepoRss('https://github.com/microsoft/vscode');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(3);
    expect(result.feeds.map((f) => f.url)).toEqual([
      'https://github.com/microsoft/vscode/releases.atom',
      'https://github.com/microsoft/vscode/commits.atom',
      'https://github.com/microsoft/vscode/tags.atom',
    ]);
  });

  test('should detect GitHub user URL', () => {
    const result = getGithubUserRss('https://github.com/octocat');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://github.com/octocat.atom');
  });

  test('should not match repo URLs with additional paths', () => {
    const result = getGithubRepoRss('https://github.com/microsoft/vscode/issues');
    expect(result.match).toBe(false);
  });
});

describe('GitLab RSS Discovery', () => {
  test('should detect GitLab repository URL', () => {
    const result = getGitlabRepoRss('https://gitlab.com/gitlab-org/gitlab');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://gitlab.com/gitlab-org/gitlab.atom');
  });

  test('should detect GitLab user URL', () => {
    const result = getGitlabUserRss('https://gitlab.com/octocat');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://gitlab.com/octocat.atom');
  });
});

describe('Other Services RSS Discovery', () => {
  test('should detect Kickstarter URL', () => {
    const result = getKickstarterRss('https://www.kickstarter.com/projects/example/project');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe(
      'https://www.kickstarter.com/projects/example/project/posts.atom',
    );
  });

  test('should detect Vimeo URL', () => {
    const result = getVimeoRss('https://vimeo.com/user123456');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://vimeo.com/user123456/videos/rss');
  });

  test('should detect Medium tag URL', () => {
    const result = getMediumTagRss('https://medium.com/tag/javascript');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://medium.com/feed/tag/javascript');
  });

  test('should detect Itch.io URL', () => {
    const result = getItchioRss('https://itch.io/games/newest');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://itch.io/games/newest.xml');
  });

  test('should detect Mirror.xyz URL', () => {
    const result = getMirrorXyzRss('https://example.mirror.xyz/post-slug');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(1);
    expect(result.feeds[0].url).toBe('https://example.mirror.xyz/feed/atom');
    expect(result.feeds[0].title).toBe('example');
  });
});

describe('WordPress RSS Discovery', () => {
  test('should detect WordPress site by wp-content URL', () => {
    const result = getWordPressRss('https://example.com/wp-content/themes/theme/style.css');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(3);
    expect(result.feeds[0].url).toBe('https://example.com/?feed=rss2');
    expect(result.feeds[1].url).toBe('https://example.com/?feed=atom');
    expect(result.feeds[2].url).toBe('https://example.com/?feed=rdf');
  });

  test('should detect WordPress site by wp-includes URL', () => {
    const result = getWordPressRss('https://blog.example.com/wp-includes/js/jquery.js');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(3);
  });

  test('should detect WordPress site by post URL', () => {
    const result = getWordPressRss('https://blog.example.com/?p=123');
    expect(result.match).toBe(true);
    expect(result.feeds).toHaveLength(3);
  });

  test('should not match non-WordPress URLs', () => {
    const result = getWordPressRss('https://example.com/regular-page');
    expect(result.match).toBe(false);
    expect(result.feeds).toHaveLength(0);
  });
});

describe('Known Services Check', () => {
  test('should find feeds for known service URL', () => {
    const result = checkKnownServices('https://www.reddit.com/r/programming');
    expect(result).not.toBeNull();
    expect(result!.match).toBe(true);
    expect(result!.feeds).toHaveLength(1);
  });

  test('should find WordPress feeds', () => {
    const result = checkKnownServices('https://blog.example.com/wp-content/uploads/image.jpg');
    expect(result).not.toBeNull();
    expect(result!.match).toBe(true);
    expect(result!.feeds).toHaveLength(3);
  });

  test('should return null for unknown URLs', () => {
    const result = checkKnownServices('https://unknown-site.com');
    expect(result).toBeNull();
  });
});
