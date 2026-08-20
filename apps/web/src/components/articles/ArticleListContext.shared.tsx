/**
 * Shared types and test utilities for ArticleListContext.
 *
 * This file has NO entity/collection imports, making it safe to import
 * from Storybook stories without pulling in server-side dependencies.
 */
import type { Article, ArticleTag, Feed, Tag } from '@repo/domain/client';
import { createContext, use, type ReactNode } from 'react';
import type { ReadStatus } from './ReadStatusToggle';

export interface ArticleListContextValue {
  articles: Article[];
  totalCount: number;
  unreadCount: number;
  archivableCount: number;
  feeds: Feed[];
  tags: Tag[];
  shortsExist: boolean;
  readStatus: ReadStatus;
  context: 'inbox' | 'feed' | 'tag';
  loadMore: () => void;
  updateArticle: (articleId: string, updates: { isRead?: boolean; isArchived?: boolean }) => void;
  markAllArchived: () => Promise<void>;
  addTag: (articleId: string, tagId: string) => void;
  removeTag: (articleTagId: string) => void;
}

export const ArticleListContext = createContext<ArticleListContextValue | undefined>(undefined);

export function useArticleList(): ArticleListContextValue {
  const ctx = use(ArticleListContext);
  if (!ctx) throw new Error('useArticleList must be used within an ArticleListProvider');
  return ctx;
}

/**
 * Test-only provider that accepts a pre-built context value.
 * Use in Storybook stories to bypass collection queries.
 */
export function MockArticleListProvider({
  value,
  children,
}: {
  value: ArticleListContextValue;
  children: ReactNode;
}) {
  return <ArticleListContext.Provider value={value}>{children}</ArticleListContext.Provider>;
}

export type { ArticleTag };
