import type { ServiceResult } from './types.js';

export function getYoutubeRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/(channel|user|c).+/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    let query = '';
    let title = '';

    const urlObj = new URL(url);
    const path = urlObj.pathname;

    if (path.startsWith('/channel/')) {
      const channelId = path.substring('/channel/'.length).split('/')[0];
      if (channelId) {
        query = 'channel_id=' + channelId;
        title = channelId;
      }
    } else if (path.startsWith('/c/')) {
      const channelId = path.substring('/c/'.length).split('/')[0];
      if (channelId) {
        query = 'user=' + channelId;
        title = channelId;
      }
    } else if (path.startsWith('/user/')) {
      const userId = path.substring('/user/'.length).split('/')[0];
      if (userId) {
        query = 'user=' + userId;
        title = userId;
      }
    }

    if (query) {
      result.feeds.push({
        url: 'https://www.youtube.com/feeds/videos.xml?' + query,
        title: title,
      });
    }
  }

  return result;
}

export function getYoutubePlaylistRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/playlist\?list=(.+)/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    const urlObj = new URL(url);
    const playlistId = urlObj.searchParams.get('list');

    if (playlistId) {
      result.feeds.push({
        url: 'https://www.youtube.com/feeds/videos.xml?playlist_id=' + playlistId,
        title: 'RSS Playlist',
      });
    }
  }

  return result;
}

export function getRedditRootRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com(\/)?$/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    const feedUrl = url.endsWith('/') ? url + '.rss' : url + '/.rss';
    result.feeds.push({
      url: feedUrl,
      title: 'Reddit Homepage',
    });
  }

  return result;
}

export function getRedditSubRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com\/r\/(.+)/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    const feedUrl = (url.endsWith('/') ? url.slice(0, -1) : url) + '.rss';
    result.feeds.push({
      url: feedUrl,
      title: 'Subreddit Feed',
    });
  }

  return result;
}

export function getRedditUserRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com\/user\/(.+)/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    const feedUrl = (url.endsWith('/') ? url.slice(0, -1) : url) + '.rss';
    result.feeds.push({
      url: feedUrl,
      title: 'Reddit User Feed',
    });
  }

  return result;
}

export function getRedditPostCommentsRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?reddit\.com\/r\/(.+)\/comments\/(.+)\/(.+)/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    const feedUrl = (url.endsWith('/') ? url.slice(0, -1) : url) + '.rss';
    result.feeds.push({
      url: feedUrl,
      title: 'Reddit Post Comments',
    });
  }

  return result;
}

export function getKickstarterRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?kickstarter\.com/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    const feedUrl = (url.endsWith('/') ? url.slice(0, -1) : url).split('?')[0] + '/posts.atom';
    result.feeds.push({
      url: feedUrl,
      title: 'Kickstarter Feed',
    });
  }

  return result;
}

export function getVimeoRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?vimeo\.com\/([a-zA-Z](.+))(\/videos)?/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    const feedUrl = url.endsWith('/videos')
      ? url.replace(/\/videos$/, '/rss')
      : url + '/videos/rss';

    result.feeds.push({
      url: feedUrl,
      title: 'Vimeo Feed',
    });
  }

  return result;
}

export function getGithubRepoRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex =
    /^(http(s)?:\/\/)?((w){3}.)?github\.com\/([a-zA-Z0-9][a-zA-Z0-9._-]*)\/([a-zA-Z0-9][a-zA-Z0-9._-]*)(?:\/)?$/i;
  const matches = url.match(regex);

  if (matches) {
    result.match = true;
    const repoUrl = matches[0].replace(/\/$/, '');
    const urlObj = new URL(repoUrl);
    const baseRepoUrl = urlObj.origin + '/' + urlObj.pathname.split('/').slice(1, 3).join('/');

    result.feeds.push({ url: baseRepoUrl + '/releases.atom', title: 'Repo releases' });
    result.feeds.push({ url: baseRepoUrl + '/commits.atom', title: 'Repo commits' });
    result.feeds.push({ url: baseRepoUrl + '/tags.atom', title: 'Repo tags' });
  }

  return result;
}

export function getGithubUserRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?github\.com\/([a-zA-Z0-9](.+))$/i;
  const matches = url.match(regex);

  if (matches) {
    result.match = true;
    const userUrl = matches[0].replace(/\/$/, '');
    result.feeds.push({ url: userUrl + '.atom', title: 'User activity' });
  }

  return result;
}

export function getGitlabRepoRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?gitlab\.com\/([a-zA-Z0-9](.+))\/([a-zA-Z0-9](.+))$/i;
  const matches = url.match(regex);

  if (matches) {
    result.match = true;
    const repoUrl = matches[0].replace(/\/$/, '');
    result.feeds.push({ url: repoUrl + '.atom', title: 'Repo commits' });
  }

  return result;
}

export function getGitlabUserRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?gitlab\.com\/([a-zA-Z0-9](.+))$/i;
  const matches = url.match(regex);

  if (matches) {
    result.match = true;
    const userUrl = matches[0].replace(/\/$/, '');
    result.feeds.push({ url: userUrl + '.atom', title: 'User activity' });
  }

  return result;
}

export function getMediumTagRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?medium\.com\/tag\/(.+)/i;
  const hasMatch = regex.test(url);

  if (hasMatch) {
    result.match = true;
    const matches = url.match(regex);
    const tag = matches?.[5];
    const feedUrl = url.replace(/(\/tag)/, '/feed$1');

    result.feeds.push({
      url: feedUrl,
      title: tag || 'Medium Tag Feed',
    });
  }

  return result;
}

export function getItchioRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^(http(s)?:\/\/)?((w){3}.)?itch\.io\/(.+)/i;
  const matches = url.match(regex);

  if (matches) {
    result.match = true;
    const feedUrl = url + '.xml';
    result.feeds.push({
      url: feedUrl,
      title: matches[5] || 'Itch.io Feed',
    });
  }

  return result;
}

export function getMirrorXyzRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const regex = /^https?:\/\/([a-zA-Z0-9-]+)\.mirror\.xyz\/[a-zA-Z0-9_-]+$/;
  const matches = url.match(regex);

  if (matches && matches[1]) {
    result.match = true;
    const urlObj = new URL(url);
    const baseUrl = urlObj.origin;
    const subdomain = matches[1];
    const feedUrl = baseUrl + '/feed/atom';

    result.feeds.push({
      url: feedUrl,
      title: subdomain,
    });
  }

  return result;
}

export function getWordPressRss(url: string): ServiceResult {
  const result: ServiceResult = { match: false, feeds: [] };

  const wordpressIndicators = [
    'wp-content',
    'wp-includes',
    'wordpress',
    '/wp/',
    '?p=',
    '/feed/',
    'xmlrpc.php',
  ];

  const hasWordPressIndicator = wordpressIndicators.some((indicator) =>
    url.toLowerCase().includes(indicator),
  );

  if (hasWordPressIndicator) {
    result.match = true;
    const urlObj = new URL(url);
    const baseUrl = urlObj.origin;

    result.feeds.push(
      { url: `${baseUrl}/?feed=rss2`, title: 'WordPress RSS' },
      { url: `${baseUrl}/?feed=atom`, title: 'WordPress Atom' },
      { url: `${baseUrl}/?feed=rdf`, title: 'WordPress RDF' },
    );
  }

  return result;
}

export const SERVICES = {
  Youtube: getYoutubeRss,
  YoutubePlaylist: getYoutubePlaylistRss,
  RedditRoot: getRedditRootRss,
  RedditSub: getRedditSubRss,
  RedditUser: getRedditUserRss,
  RedditPostComments: getRedditPostCommentsRss,
  Kickstarter: getKickstarterRss,
  Vimeo: getVimeoRss,
  GithubRepo: getGithubRepoRss,
  GithubUser: getGithubUserRss,
  GitlabRepo: getGitlabRepoRss,
  GitlabUser: getGitlabUserRss,
  MediumTag: getMediumTagRss,
  Itchio: getItchioRss,
  MirrorXyz: getMirrorXyzRss,
  WordPress: getWordPressRss,
} as const;

export function checkKnownServices(url: string): ServiceResult | null {
  for (const [, serviceChecker] of Object.entries(SERVICES)) {
    const result = serviceChecker(url);
    if (result.match) {
      return result;
    }
  }
  return null;
}
