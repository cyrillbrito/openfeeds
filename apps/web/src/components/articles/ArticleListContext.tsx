/**
 * Article list context — owns all queries and mutation handlers.
 *
 * Each route wraps its article list UI in `<ArticleListProvider>` with a
 * route-specific query filter. The provider creates all reactive state
 * internally; child components access it via `useArticleList()`.
 *
 * This keeps route components thin: they configure the filter and compose the UI.
 *
 * Pagination note: with virtualized rendering (see ArticleList.tsx), the
 * articles query has no `.limit()` — all matching rows from the local
 * collection are loaded and the virtualizer renders only what's visible.
 * `totalCount` is therefore just `articles().length`.
 */
import type { Article, ArticleTag, Feed, Tag } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { type Ref, and, eq, ilike, useLiveQuery } from '@tanstack/solid-db';
import { type Accessor, type JSX, onMount } from 'solid-js';
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

function createArticleTagsAccessorFn(articleId: string): Accessor<ArticleTag[]> {
  const query = useLiveQuery((q) =>
    q
      .from({ articleTag: articleTagsCollection })
      .where(({ articleTag }) => eq(articleTag.articleId, articleId)),
  );
  return () => (query() as ArticleTag[] | undefined) ?? [];
}

type SortDirection = 'asc' | 'desc';

export interface ArticleQueryFilter {
  /** Base query with from + joins + where (no select, orderBy, or limit). */
  buildQuery: (q: any, extra: { readStatusWhere: ((article: Ref<Article>) => any) | null }) => any;
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

  // Data queries
  const feedsQuery = useFeeds();
  const tagsQuery = useTags();

  // Main articles query — no `.limit()` because the article list is virtualized.
  // The local collection holds at most a few thousand rows for a given filter,
  // and only ~10–15 cards exist in the DOM at once thanks to windowing.
  const articlesQuery = useLiveQuery((q) => {
    const filter = readStatusFilter(props.readStatus(), sessionReadIds());
    return props.filter
      .buildQuery(q, { readStatusWhere: filter })
      .orderBy(({ article }: { article: Ref<Article> }) => article.pubDate, direction());
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
  // NOTE: iterate articlesQuery.state (a @solid-primitives ReactiveMap) directly
  // instead of calling articlesQuery() — calling the accessor goes through
  // createResource, which suspends the parent <Suspense> whenever the underlying
  // collection rebuilds (e.g. on filter/sort change). That suspension detaches
  // the list from the DOM, collapses page height, and resets window.scrollY.
  //
  // The ReactiveMap is updated by useLiveQuery's internal subscribeChanges
  // listener on every insert/update/delete, and iterating .values() tracks all
  // mutations (including updates to existing keys — touching only .size would
  // miss in-place updates such as toggling isArchived, leaving cards stale).
  const articles = (): Article[] => {
    return Array.from(articlesQuery.state.values()) as unknown as Article[];
  };
  const totalCount = () => articles().length;
  const unreadCount = () => (unreadCountQuery() || []).length;
  const archivableCount = () => (archivableQuery() || []).length;
  const feeds = (): Feed[] => (feedsQuery() as Feed[] | undefined) || [];
  const tags = (): Tag[] => (tagsQuery() as Tag[] | undefined) || [];
  const shortsExist = () => (shortsQuery()?.length ?? 0) > 0;

  // Handlers
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
    updateArticle,
    markAllArchived,
    addTag: addArticleTag,
    removeTag: removeArticleTag,
    createArticleTagsAccessor: createArticleTagsAccessorFn,
  };

  return <ArticleListContext.Provider value={value}>{props.children}</ArticleListContext.Provider>;
}
