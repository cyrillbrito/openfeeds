/**
 * Article list context — owns all queries, pagination, and mutation handlers.
 *
 * Each route wraps its article list UI in `<ArticleListProvider>` with a
 * route-specific query filter. The provider creates all reactive state
 * internally; child components access it via `useArticleList()`.
 *
 * This keeps route components thin: they configure the filter and compose the UI.
 */
import type { Article, ArticleTag, Feed, Tag } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { and, eq, ilike, useLiveQuery } from '@tanstack/react-db';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
import { readStatusFilter } from '~/utils/article-queries';
import { ArticleListContext, type ArticleListContextValue } from './ArticleListContext.shared';
import type { ReadStatus } from './ReadStatusToggle';

// Re-export shared types and utilities for non-Storybook consumers
export {
  type ArticleListContextValue,
  MockArticleListProvider,
  useArticleList,
} from './ArticleListContext.shared';
export { type ReadStatus } from './ReadStatusToggle';

export const ARTICLES_PER_PAGE = 20;

function addArticleTag(articleId: string, tagId: string) {
  articleTagsCollection.insert({
    id: createId(),
    userId: '', // Will be set by server
    articleId,
    tagId,
  });
}

function removeArticleTag(articleTagId: string) {
  articleTagsCollection.delete(articleTagId);
}

/** Hook to query article-tags for a specific article. Call from components, not callbacks. */
export function useArticleTagsForArticle(articleId: string): ArticleTag[] {
  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ articleTag: articleTagsCollection })
        .where(({ articleTag }) => eq(articleTag.articleId, articleId)),
    [articleId],
  );
  return (data as ArticleTag[] | undefined) ?? [];
}

type SortDirection = 'asc' | 'desc';

export interface ArticleQueryFilter {
  /** Base query with from + joins + where (no select, orderBy, or limit). */
  buildQuery: (q: any, extra: { readStatusWhere: ((article: any) => any) | null }) => any;
  /** Build a count-only query variant (no limit, select id only). */
  buildCountQuery: (
    q: any,
    extra: { readStatusWhere: ((article: any) => any) | null },
  ) => any;
  /** Build the unread count query (ignores current read status filter). */
  buildUnreadQuery: (q: any) => any;
  /** Build the archivable count query (all non-archived, ignores read status). */
  buildArchivableQuery: (q: any) => any;
}

export interface ArticleListProviderProps {
  filter: ArticleQueryFilter;
  readStatus: ReadStatus;
  sortDirection?: SortDirection;
  viewKey: string;
  context: 'inbox' | 'feed' | 'tag';
  /** Optional callback when an article is archived (e.g. for toast with undo). */
  onArchive?: (articleId: string) => void;
  children: ReactNode;
}

export function ArticleListProvider({
  filter,
  readStatus,
  sortDirection,
  viewKey,
  context,
  onArchive,
  children,
}: ArticleListProviderProps) {
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();
  const direction = sortDirection ?? 'desc';

  useEffect(() => {
    setViewKey(viewKey);
  }, [viewKey, setViewKey]);

  const [visibleCount, setVisibleCount] = useState(ARTICLES_PER_PAGE);

  const feedsData = useFeeds();
  const tagsData = useTags();

  // Main articles query — re-runs when read status, session reads, page size, or sort changes
  const { data: articlesData } = useLiveQuery(
    (q) => {
      const filterFn = readStatusFilter(readStatus, sessionReadIds);
      return filter
        .buildQuery(q, { readStatusWhere: filterFn })
        .orderBy(({ article }: { article: any }) => article.pubDate, direction)
        .limit(visibleCount);
    },
    [readStatus, sessionReadIds, filter, direction, visibleCount],
  );

  const { data: totalCountData } = useLiveQuery(
    (q) => {
      const filterFn = readStatusFilter(readStatus, sessionReadIds);
      return filter.buildCountQuery(q, { readStatusWhere: filterFn });
    },
    [readStatus, sessionReadIds, filter],
  );

  const { data: unreadCountData } = useLiveQuery(
    (q) => filter.buildUnreadQuery(q),
    [filter],
  );

  const { data: archivableData } = useLiveQuery(
    (q) => filter.buildArchivableQuery(q),
    [filter],
  );

  const { data: shortsData } = useLiveQuery(
    (q) =>
      q
        .from({ article: articlesCollection })
        .where(({ article }: { article: any }) =>
          and(eq(article.isArchived, false), ilike(article.url, '%youtube.com/shorts%')),
        )
        .orderBy(({ article }: { article: any }) => article.pubDate, 'desc')
        .limit(1),
    [],
  );

  const articles: Article[] = (articlesData as Article[] | undefined) ?? [];
  const feeds: Feed[] = (feedsData as Feed[] | undefined) ?? [];
  const tags: Tag[] = (tagsData as Tag[] | undefined) ?? [];
  const totalCount = (totalCountData?.length ?? 0);
  const unreadCount = (unreadCountData?.length ?? 0);
  const archivableCount = (archivableData?.length ?? 0);
  const shortsExist = (shortsData?.length ?? 0) > 0;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  }, []);

  const updateArticle = useCallback(
    (articleId: string, updates: { isRead?: boolean; isArchived?: boolean }) => {
      if (updates.isRead === true) {
        addSessionRead(articleId);
      }
      if (updates.isArchived === true) {
        onArchive?.(articleId);
      }
      articlesCollection.update(articleId, (draft) => {
        if (updates.isRead !== undefined) draft.isRead = updates.isRead;
        if (updates.isArchived !== undefined) draft.isArchived = updates.isArchived;
      });
    },
    [addSessionRead, onArchive],
  );

  const markAllArchived = useCallback(async () => {
    const results = (archivableData || []) as { id: string }[];
    const articleIds = results.map((a) => a.id);
    if (articleIds.length > 0) {
      articlesCollection.update(articleIds, (drafts) => {
        drafts.forEach((d) => (d.isArchived = true));
      });
    }
  }, [archivableData]);

  const value = useMemo<ArticleListContextValue>(
    () => ({
      articles,
      totalCount,
      unreadCount,
      archivableCount,
      feeds,
      tags,
      shortsExist,
      readStatus,
      context,
      loadMore,
      updateArticle,
      markAllArchived,
      addTag: addArticleTag,
      removeTag: removeArticleTag,
    }),
    [
      articles,
      totalCount,
      unreadCount,
      archivableCount,
      feeds,
      tags,
      shortsExist,
      readStatus,
      context,
      loadMore,
      updateArticle,
      markAllArchived,
    ],
  );

  return <ArticleListContext.Provider value={value}>{children}</ArticleListContext.Provider>;
}
