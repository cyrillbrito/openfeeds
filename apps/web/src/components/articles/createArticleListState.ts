/**
 * Shared hook for article list state — queries, pagination, and mutation handlers.
 *
 * Each route calls this with its specific query filter. The hook owns:
 * - 4 standard queries (articles, totalCount, unreadCount, archivable)
 * - Article tags query for the displayed articles
 * - Shorts existence check
 * - Pagination state (visibleCount + loadMore)
 * - Mutation handlers (updateArticle, markAllArchived, addTag, removeTag)
 *
 * This keeps route components thin: they configure the filter and compose the UI.
 */
import type { Article, ArticleTag } from '@repo/domain/client';
import { createId } from '@repo/shared/utils';
import { type Ref, and, eq, ilike, useLiveQuery } from '@tanstack/solid-db';
import { createSignal, onMount } from 'solid-js';
import type { Accessor } from 'solid-js';
import { articleTagsCollection } from '~/entities/article-tags';
import { articlesCollection } from '~/entities/articles';
import { useFeeds } from '~/entities/feeds';
import { useTags } from '~/entities/tags';
import { useSessionRead } from '~/providers/session-read';
import { readStatusFilter } from '~/utils/article-queries';
import { ARTICLES_PER_PAGE } from './ArticleList';
import type { ReadStatus } from './ReadStatusToggle';

type SortDirection = 'asc' | 'desc';

export interface ArticleQueryFilter {
  /** Base where-clause applied to all queries (e.g. feedId filter, tag join) */
  buildQuery: (q: any, extra: { readStatusWhere: ((article: Ref<Article>) => any) | null }) => any;
  /** Build a count-only query variant (no limit, select id only) */
  buildCountQuery: (
    q: any,
    extra: { readStatusWhere: ((article: Ref<Article>) => any) | null },
  ) => any;
  /** Build the unread count query (ignores current read status filter) */
  buildUnreadQuery: (q: any) => any;
  /** Build the archivable count query (all non-archived, ignores read status) */
  buildArchivableQuery: (q: any) => any;
}

export interface ArticleListStateConfig {
  filter: ArticleQueryFilter;
  readStatus: Accessor<ReadStatus>;
  sortDirection?: Accessor<SortDirection>;
  viewKey: string;
  /** Optional callback when an article is archived (e.g. for toast with undo) */
  onArchive?: (articleId: string) => void;
}

export interface ArticleListState {
  articles: Accessor<Article[]>;
  totalCount: Accessor<number>;
  unreadCount: Accessor<number>;
  archivableCount: Accessor<number>;
  feeds: Accessor<any[]>;
  tags: Accessor<any[]>;
  articleTags: Accessor<ArticleTag[]>;
  shortsExist: Accessor<boolean>;
  loadMore: () => void;
  updateArticle: (articleId: string, updates: { isRead?: boolean; isArchived?: boolean }) => void;
  markAllArchived: () => Promise<void>;
  addTag: (articleId: string, tagId: string) => void;
  removeTag: (articleTagId: string) => void;
}

export function createArticleListState(config: ArticleListStateConfig): ArticleListState {
  const { sessionReadIds, addSessionRead, setViewKey } = useSessionRead();
  const direction = config.sortDirection ?? (() => 'desc' as SortDirection);

  onMount(() => setViewKey(config.viewKey));

  // Pagination
  const [visibleCount, setVisibleCount] = createSignal(ARTICLES_PER_PAGE);

  // Data queries
  const feedsQuery = useFeeds();
  const tagsQuery = useTags();

  // Main articles query
  const articlesQuery = useLiveQuery((q) => {
    const filter = readStatusFilter(config.readStatus(), sessionReadIds());
    return config.filter
      .buildQuery(q, { readStatusWhere: filter })
      .orderBy(({ article }: { article: Ref<Article> }) => article.pubDate, direction())
      .limit(visibleCount());
  });

  // Total count query (current read status filter, no limit)
  const totalCountQuery = useLiveQuery((q) => {
    const filter = readStatusFilter(config.readStatus(), sessionReadIds());
    return config.filter.buildCountQuery(q, { readStatusWhere: filter });
  });

  // Unread count (independent of current read status filter)
  const unreadCountQuery = useLiveQuery((q) => config.filter.buildUnreadQuery(q));

  // Archivable count (all non-archived)
  const archivableQuery = useLiveQuery((q) => config.filter.buildArchivableQuery(q));

  // Article tags for the displayed articles
  const articleTagsQuery = useLiveQuery((q) => q.from({ articleTag: articleTagsCollection }));

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
  const feeds = () => feedsQuery() || [];
  const tags = () => tagsQuery() || [];
  const articleTags = (): ArticleTag[] => articleTagsQuery() || [];
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
      config.onArchive?.(articleId);
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

  return {
    articles,
    totalCount,
    unreadCount,
    archivableCount,
    feeds,
    tags,
    articleTags,
    shortsExist,
    loadMore,
    updateArticle,
    markAllArchived,
    addTag,
    removeTag,
  };
}
