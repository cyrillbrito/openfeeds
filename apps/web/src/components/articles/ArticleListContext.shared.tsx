/**
 * Shared types and test utilities for ArticleListContext.
 *
 * This file has NO entity/collection imports, making it safe to import
 * from Storybook stories without pulling in server-side dependencies.
 */
import type { Article, ArticleTag, Feed, Tag } from '@repo/domain/client';
import { type Accessor, type JSX, createContext, useContext } from 'solid-js';
import type { ReadStatus } from './ReadStatusToggle';

export interface ArticleListContextValue {
  articles: Accessor<Article[]>;
  totalCount: Accessor<number>;
  unreadCount: Accessor<number>;
  archivableCount: Accessor<number>;
  feeds: Accessor<Feed[]>;
  tags: Accessor<Tag[]>;
  shortsExist: Accessor<boolean>;
  readStatus: Accessor<ReadStatus>;
  context: 'inbox' | 'feed' | 'tag';
  loadMore: () => void;
  updateArticle: (articleId: string, updates: { isRead?: boolean; isArchived?: boolean }) => void;
  markAllArchived: () => Promise<void>;
  addTag: (articleId: string, tagId: string) => void;
  removeTag: (articleTagId: string) => void;
  /**
   * Creates a scoped useLiveQuery for article-tags filtered by articleId.
   * Each call creates an independent reactive subscription unaffected by
   * the parent articles query's reconcile cycle.
   */
  createArticleTagsAccessor: (articleId: string) => Accessor<ArticleTag[]>;
}

export const ArticleListContext = createContext<ArticleListContextValue>();

export function useArticleList(): ArticleListContextValue {
  const ctx = useContext(ArticleListContext);
  if (!ctx) throw new Error('useArticleList must be used within an ArticleListProvider');
  return ctx;
}

/**
 * Test-only provider that accepts a pre-built context value.
 * Use in Storybook stories to bypass collection queries.
 */
export function MockArticleListProvider(props: {
  value: ArticleListContextValue;
  children: JSX.Element;
}) {
  return (
    <ArticleListContext.Provider value={props.value}>{props.children}</ArticleListContext.Provider>
  );
}
