import type { DbArticle, DbFeed, DbFilterRule, DbTag } from '@repo/db';
import type { Article, Feed, FilterRule, Tag, TagColor } from '@repo/shared/types';

/**
 * Utility functions for timestamp conversion between DB (unix seconds) and API (ISO string) formats
 */

/**
 * Convert ISO string to Date object
 */
export function isoToDate(iso: string | null): Date | null {
  if (iso === null) return null;
  return new Date(iso);
}

/**
 * Extended DB types with relation data for API conversion
 * These interfaces represent database query results that include joined relation data
 */
export interface DbArticleWithTags extends DbArticle {
  articleTags: { tagId: string }[];
}

/**
 * Convert database article to API article format
 */
export function articleDbToApi(dbArticle: DbArticleWithTags): Article {
  return {
    id: dbArticle.id,
    feedId: dbArticle.feedId,
    title: dbArticle.title,
    url: dbArticle.url,
    description: dbArticle.description,
    content: dbArticle.content,
    author: dbArticle.author,
    pubDate: dbArticle.pubDate ?? null,
    isRead: dbArticle.isRead,
    isArchived: dbArticle.isArchived,
    hasCleanContent: !!dbArticle.cleanContent,
    tags: dbArticle.articleTags.map((at) => at.tagId),
    createdAt: dbArticle.createdAt,
  };
}

export interface DbFeedWithTags extends DbFeed {
  feedTags: { tagId: string }[];
}

/**
 * Convert database feed to API feed format
 */
export function feedDbToApi(dbFeed: DbFeedWithTags): Feed {
  return {
    id: dbFeed.id,
    url: dbFeed.url, // webpage URL
    feedUrl: dbFeed.feedUrl, // RSS/Atom feed URL
    title: dbFeed.title,
    icon: dbFeed.icon,
    description: dbFeed.description,
    createdAt: dbFeed.createdAt.toISOString(),
    lastSyncAt: dbFeed.lastSyncAt?.toISOString() ?? null,
    tags: dbFeed.feedTags.map((ft) => ft.tagId),
  };
}

/**
 * Convert database tag to API tag format
 */
export function tagDbToApi(dbTag: DbTag): Tag {
  return {
    id: dbTag.id,
    name: dbTag.name,
    color: dbTag.color as TagColor,
    createdAt: dbTag.createdAt.toISOString(),
  };
}

/**
 * Convert database filter rule to API filter rule format
 */
export function filterRuleDbToApi(dbRule: DbFilterRule): FilterRule {
  return {
    id: dbRule.id,
    feedId: dbRule.feedId,
    pattern: dbRule.pattern,
    operator: dbRule.operator as 'includes' | 'not_includes',
    isActive: dbRule.isActive,
    createdAt: dbRule.createdAt.toISOString(),
    updatedAt: dbRule.updatedAt?.toISOString(),
  };
}
