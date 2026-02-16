import type { DbArticle, DbFeed, DbFilterRule, DbTag } from '@repo/db';
import type { Article } from './entities/article.schema';
import type { Feed } from './entities/feed.schema';
import type { FilterRule } from './entities/filter-rule.schema';
import type { Tag, TagColor } from './entities/tag.schema';

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
 * Convert database article to API article format
 * Article tags are now managed separately via the article-tags collection
 */
export function articleDbToApi(dbArticle: DbArticle): Article {
  return {
    id: dbArticle.id,
    feedId: dbArticle.feedId,
    title: dbArticle.title,
    url: dbArticle.url,
    description: dbArticle.description,
    content: dbArticle.content,
    author: dbArticle.author,
    pubDate: dbArticle.pubDate?.toISOString() ?? null,
    isRead: dbArticle.isRead,
    isArchived: dbArticle.isArchived,
    hasCleanContent: !!dbArticle.cleanContent,
    createdAt: dbArticle.createdAt.toISOString(),
  };
}

/**
 * Convert database feed to API feed format
 */
export function feedDbToApi(dbFeed: DbFeed): Feed {
  return {
    id: dbFeed.id,
    url: dbFeed.url, // webpage URL
    feedUrl: dbFeed.feedUrl, // RSS/Atom feed URL
    title: dbFeed.title,
    icon: dbFeed.icon,
    description: dbFeed.description,
    createdAt: dbFeed.createdAt.toISOString(),
    updatedAt: dbFeed.updatedAt.toISOString(),
    lastSyncAt: dbFeed.lastSyncAt?.toISOString() ?? null,
    syncStatus: dbFeed.syncStatus as Feed['syncStatus'],
    syncError: dbFeed.syncError,
    syncFailCount: dbFeed.syncFailCount,
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
    updatedAt: dbTag.updatedAt.toISOString(),
  };
}

/**
 * Convert database filter rule to API filter rule format
 */
export function filterRuleDbToApi(dbRule: DbFilterRule): FilterRule {
  return {
    id: dbRule.id,
    userId: dbRule.userId,
    feedId: dbRule.feedId,
    pattern: dbRule.pattern,
    operator: dbRule.operator as 'includes' | 'not_includes',
    isActive: dbRule.isActive,
    createdAt: dbRule.createdAt.toISOString(),
    updatedAt: dbRule.updatedAt?.toISOString(),
  };
}
