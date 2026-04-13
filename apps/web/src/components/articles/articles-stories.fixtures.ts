/**
 * Shared fixtures for article Storybook stories.
 *
 * Provides realistic Article, Feed, Tag, and ArticleTag objects
 * that can be composed into different story scenarios.
 */
import type { Article, ArticleTag, Feed, Tag } from '@repo/domain/client';

const now = new Date().toISOString();
const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60).toISOString();
const threeDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
const oneWeekAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

// --- Feeds ---

export const techCrunchFeed: Feed = {
  id: 'feed-1',
  userId: 'user-1',
  url: 'https://techcrunch.com',
  feedUrl: 'https://techcrunch.com/feed/',
  title: 'TechCrunch',
  description: 'Startup and technology news',
  icon: 'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
  createdAt: oneWeekAgo,
  updatedAt: now,
  lastSyncAt: now,
  syncStatus: 'ok',
  syncError: null,
};

export const hackerNewsFeed: Feed = {
  id: 'feed-2',
  userId: 'user-1',
  url: 'https://news.ycombinator.com',
  feedUrl: 'https://news.ycombinator.com/rss',
  title: 'Hacker News',
  description: 'Links for the intellectually curious',
  icon: null,
  createdAt: oneWeekAgo,
  updatedAt: now,
  lastSyncAt: now,
  syncStatus: 'ok',
  syncError: null,
};

export const failingFeed: Feed = {
  id: 'feed-3',
  userId: 'user-1',
  url: 'https://example.com',
  feedUrl: 'https://example.com/feed.xml',
  title: 'Broken Blog',
  description: 'A feed that is failing to sync',
  icon: null,
  createdAt: oneWeekAgo,
  updatedAt: threeDaysAgo,
  lastSyncAt: threeDaysAgo,
  syncStatus: 'failing',
  syncError: 'HTTP 503 Service Unavailable',
};

export const feedFixtures: Feed[] = [techCrunchFeed, hackerNewsFeed, failingFeed];

// --- Tags ---

export const techTag: Tag = {
  id: 'tag-1',
  userId: 'user-1',
  name: 'Tech',
  color: 'blue',
  order: 0,
  createdAt: oneWeekAgo,
  updatedAt: oneWeekAgo,
};

export const aiTag: Tag = {
  id: 'tag-2',
  userId: 'user-1',
  name: 'AI',
  color: 'purple',
  order: 1,
  createdAt: oneWeekAgo,
  updatedAt: oneWeekAgo,
};

export const newsTag: Tag = {
  id: 'tag-3',
  userId: 'user-1',
  name: 'News',
  color: 'red',
  order: 2,
  createdAt: oneWeekAgo,
  updatedAt: oneWeekAgo,
};

export const tagFixtures: Tag[] = [techTag, aiTag, newsTag];

// --- Articles ---

export const unreadArticle: Article = {
  id: 'article-1',
  userId: 'user-1',
  feedId: 'feed-1',
  title: 'OpenAI Announces New Model with Reasoning Capabilities',
  url: 'https://techcrunch.com/2024/01/15/openai-new-model/',
  description:
    'OpenAI has released a new AI model that demonstrates significant improvements in logical reasoning and multi-step problem solving.',
  content: null,
  author: 'Sarah Chen',
  pubDate: oneHourAgo,
  isRead: false,
  isArchived: false,
  cleanContent: null,
  contentExtractedAt: null,
  createdAt: oneHourAgo,
};

export const readArticle: Article = {
  id: 'article-2',
  userId: 'user-1',
  feedId: 'feed-2',
  title: 'Show HN: A local-first RSS reader built with SolidJS',
  url: 'https://news.ycombinator.com/item?id=12345',
  description:
    'I built a local-first RSS reader using SolidJS, TanStack DB, and Electric SQL for real-time sync.',
  content: null,
  author: null,
  pubDate: threeDaysAgo,
  isRead: true,
  isArchived: false,
  cleanContent: null,
  contentExtractedAt: null,
  createdAt: threeDaysAgo,
};

export const archivedArticle: Article = {
  id: 'article-3',
  userId: 'user-1',
  feedId: 'feed-1',
  title: 'The State of Web Development in 2024',
  url: 'https://techcrunch.com/2024/01/10/web-dev-2024/',
  description: 'A comprehensive overview of web development trends heading into 2024.',
  content: null,
  author: 'Alex Rivera',
  pubDate: oneWeekAgo,
  isRead: true,
  isArchived: true,
  cleanContent: null,
  contentExtractedAt: null,
  createdAt: oneWeekAgo,
};

export const htmlDescriptionArticle: Article = {
  id: 'article-4',
  userId: 'user-1',
  feedId: 'feed-2',
  title: 'Understanding Reactivity in Modern Frameworks',
  url: 'https://news.ycombinator.com/item?id=67890',
  description:
    '<p>A deep dive into <strong>fine-grained reactivity</strong> comparing SolidJS, Svelte, and Vue.</p><blockquote>Signals are the future of UI state management.</blockquote>',
  content: null,
  author: 'Jamie Woods',
  pubDate: threeDaysAgo,
  isRead: false,
  isArchived: false,
  cleanContent: null,
  contentExtractedAt: null,
  createdAt: threeDaysAgo,
};

export const youtubeArticle: Article = {
  id: 'article-5',
  userId: 'user-1',
  feedId: 'feed-1',
  title: 'Quick Demo: Electric SQL Sync in 60 Seconds',
  url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
  description: 'A quick demo showing Electric SQL real-time sync capabilities.',
  content: null,
  author: null,
  pubDate: oneHourAgo,
  isRead: false,
  isArchived: false,
  cleanContent: null,
  contentExtractedAt: null,
  createdAt: oneHourAgo,
};

export const noFeedArticle: Article = {
  id: 'article-6',
  userId: 'user-1',
  feedId: null,
  title: 'Saved Article: Best Practices for Local-First Apps',
  url: 'https://example.com/local-first',
  description: 'A guide on building local-first applications with offline support.',
  content: null,
  author: 'Pat Morgan',
  pubDate: threeDaysAgo,
  isRead: false,
  isArchived: false,
  cleanContent: null,
  contentExtractedAt: null,
  createdAt: threeDaysAgo,
};

export const articleFixtures: Article[] = [
  unreadArticle,
  readArticle,
  archivedArticle,
  htmlDescriptionArticle,
  youtubeArticle,
  noFeedArticle,
];

// --- Article Tags ---

export const articleTagFixtures: ArticleTag[] = [
  { id: 'at-1', userId: 'user-1', articleId: 'article-1', tagId: 'tag-1' },
  { id: 'at-2', userId: 'user-1', articleId: 'article-1', tagId: 'tag-2' },
  { id: 'at-3', userId: 'user-1', articleId: 'article-2', tagId: 'tag-1' },
  { id: 'at-4', userId: 'user-1', articleId: 'article-4', tagId: 'tag-3' },
];

/** A convenient subset: only unread, non-archived articles */
export const unreadArticles: Article[] = articleFixtures.filter((a) => !a.isRead && !a.isArchived);

/** A convenient subset: articles with feed-1 */
export const techCrunchArticles: Article[] = articleFixtures.filter((a) => a.feedId === 'feed-1');
