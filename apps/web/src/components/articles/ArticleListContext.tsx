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
import { type Ref, and, eq, ilike, useLiveQuery } from '@tanstack/solid-db';
import { type Accessor, type JSX, createSignal, onMount } from 'solid-js';
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

type SortDirection = 'asc' | 'desc';

export interface ArticleQueryFilter {
  /** Base query with from + joins + where (no select, orderBy, or limit). */
  buildQuery: (q: any, extra: { readStatusWhere: ((article: Ref<Article>) => any) | null }) => any;
  /** Build a count-only query variant (no limit, select id only). */
  buildCountQuery: (
    q: any,
    extra: { readStatusWhere: ((article: Ref<Article>) => any) | null },
  ) => any;
  /** Build the unread count query (ignores current read status filter). */
  buildUnreadQuery: (q: any) => any;
  /** Build the archivable count query (all non-archived, ignores read status). */
  buildArchivableQuery: (q: any) => any;
}

export interface ArticleListProviderProps {
  filter: ArticleQueryFilter;
  readStatus: Accessor<ReadStatus>;
  sortDirection?: Accessor<SortDirection>;
  viewKey: string;
  context: 'inbox' | 'feed' | 'tag';
  /** Optional callback when an article is archived (e.g. for toast with undo). */
  onArchive?: (articleId: string) => void;
  children: JSX.Element;
}

export function ArticleListProvider(props: ArticleListProviderProps) {
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();
  const direction = props.sortDirection ?? (() => 'desc' as SortDirection);

  onMount(() => setViewKey(props.viewKey));

  // Pagination
  const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);

  // Data queries
  const feedsQuery = useFeeds();
  const tagsQuery = useTags();

  // Main articles query
  const articlesQuery = useLiveQuery((q) => {
    const filter = readStatusFilter(props.readStatus(), sessionReadIds());
    return props.filter
      .buildQuery(q, { readStatusWhere: filter })
      .orderBy(({ article }: { article: Ref<Article> }) => article.pubDate, direction())
      .limit(visibleCount());
  });

  // Total count query (current read status filter, no limit)
  const totalCountQuery = useLiveQuery((q) => {
    const filter = readStatusFilter(props.readStatus(), sessionReadIds());
    return props.filter.buildCountQuery(q, { readStatusWhere: filter });
  });

  // Unread count (independent of current read status filter)
  const unreadCountQuery = useLiveQuery((q) => props.filter.buildUnreadQuery(q));

  // Archivable count (all non-archived)
  const archivableQuery = useLiveQuery((q) => props.filter.buildArchivableQuery(q));

  // Shorts existence check
  const shortsQuery = useLiveQuery((q) =>
    q
      .from({ article: articlesCollection })
      .where(({ article }: { article: Ref<Article> }) =>
        and(eq(article.isArchived, false), ilike(article.url, '%youtube.com/shorts%')),
      )
      .orderBy(({ article }: { article: Ref<Article> }) => article.pubDate, 'desc')
      .limit(1),
  );

  // Derived values
  const articles = (): Article[] => (articlesQuery() as Article[] | undefined) || [];
  const totalCount = () => (totalCountQuery() || []).length;
  const unreadCount = () => (unreadCountQuery() || []).length;
  const archivableCount = () => (archivableQuery() || []).length;
  const feeds = (): Feed[] => (feedsQuery() as Feed[] | undefined) || [];
  const tags = (): Tag[] => (tagsQuery() as Tag[] | undefined) || [];
  const shortsExist = () => (shortsQuery()?.length ?? 0) > 0;

  // Handlers
  const loadMore = () => {
    setVisibleCount((prev) => prev + ARTICLES_PER_PAGE);
  };

  const updateArticle = (
    articleId: string,
    updates: { isRead?: boolean; isArchived?: boolean },
  ) => {
    if (updates.isRead === true) {
      addSessionRead(articleId);
    }
    if (updates.isArchived === true) {
      props.onArchive?.(articleId);
    }
    articlesCollection.update(articleId, (draft) => {
      if (updates.isRead !== undefined) draft.isRead = updates.isRead;
      if (updates.isArchived !== undefined) draft.isArchived = updates.isArchived;
    });
  };

  const markAllArchived = async () => {
    const results = (archivableQuery() || []) as { id: string }[];
    const articleIds = results.map((a) => a.id);
    if (articleIds.length > 0) {
      articlesCollection.update(articleIds, (drafts) => {
        drafts.forEach((d) => (d.isArchived = true));
      });
    }
  };

  const addTag = (articleId: string, tagId: string) => {
    articleTagsCollection.insert({
      id: createId(),
      userId: '', // Will be set by server
      articleId,
      tagId,
    });
  };

  const removeTag = (articleTagId: string) => {
    articleTagsCollection.delete(articleTagId);
  };

  const createArticleTagsAccessor = (articleId: string): Accessor<ArticleTag[]> => {
    const query = useLiveQuery((q) =>
      q
        .from({ articleTag: articleTagsCollection })
        .where(({ articleTag }) => eq(articleTag.articleId, articleId)),
    );
    return () => (query() as ArticleTag[] | undefined) ?? [];
  };

  const value: ArticleListContextValue = {
    articles,
    totalCount,
    unreadCount,
    archivableCount,
    feeds,
    tags,
    shortsExist,
    readStatus: props.readStatus,
    context: props.context,
    loadMore,
    updateArticle,
    markAllArchived,
    addTag,
    removeTag,
    createArticleTagsAccessor,
  };

  return <ArticleListContext.Provider value={value}>{props.children}</ArticleListContext.Provider>;
}
