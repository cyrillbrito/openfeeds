import { ArticleSchema } from '@repo/shared/schemas';
import type { Article } from '@repo/shared/types';
import { parseLoadSubsetOptions } from '@tanstack/db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { useApi } from '../hooks/api';
import { getErrorMessage } from './utils';

// Articles Collection
export const articlesCollection = createCollection(
  queryCollectionOptions({
    id: 'articles',
    queryKey: ['articles'],
    queryClient,
    getKey: (item: Article) => item.id,
    schema: ArticleSchema,
    syncMode: 'on-demand', // Load data incrementally when queried

    // Fetch articles with server-side filtering (predicate push-down)
    // When views create live queries with .where() clauses, those filters
    // are passed here via ctx.meta.loadSubsetOptions
    queryFn: async (ctx) => {
      const api = useApi();
      const { signal } = ctx;

      // Parse filters from live queries
      const loadSubsetOptions = ctx.meta?.loadSubsetOptions as
        | { where?: any; orderBy?: any; limit?: number }
        | undefined;
      const parsed = parseLoadSubsetOptions({
        where: loadSubsetOptions?.where,
        orderBy: loadSubsetOptions?.orderBy,
        limit: loadSubsetOptions?.limit,
      });

      // Build API query parameters from parsed filters
      const query: Record<string, any> = {
        limit: parsed.limit || 10000,
      };

      // Map filters to API parameters
      parsed.filters.forEach(({ field, operator, value }) => {
        const fieldName = field[field.length - 1]; // Get last part of path (e.g., 'feedId' from ['articles', 'feedId'])

        if (operator === 'eq') {
          query[fieldName] = value;
        }
        // Add other operators as needed (gt, lt, etc.)
      });

      // Map sorting (API uses cursor pagination, may not need explicit sort)
      // parsed.sorts can be used if API supports orderBy parameter

      const { data, error } = await api.articles.get({
        query,
        fetch: { signal },
      });

      if (error) {
        throw new Error(getErrorMessage(error));
      }

      return data?.data || [];
    },

    // Articles are created server-side via RSS fetch
    // No client-side creation needed
    onInsert: async () => {
      // Not implemented - articles are created by RSS feed sync
    },

    // Handle client-side updates (isRead, isArchived, tags)
    onUpdate: async ({ transaction }) => {
      const api = useApi();
      await Promise.all(
        transaction.mutations.map(async (mutation) => {
          const article = mutation.modified as Article;
          const changes = mutation.changes as {
            isRead?: boolean;
            isArchived?: boolean;
            tags?: number[];
          };

          // Send only changed fields to server
          const { data, error } = await api.articles({ id: article.id }).put(changes);
          if (error) {
            throw new Error(getErrorMessage(error));
          }
          return data;
        }),
      );
    },

    // Articles are archived, not deleted
    // No client-side deletion needed
    onDelete: async () => {
      // Not implemented - articles are typically archived
    },
  }),
);

/**
 * Update an existing article
 * Applies optimistic update immediately - UI updates via live queries
 */
export function updateArticle(
  id: number,
  changes: {
    isRead?: boolean;
    isArchived?: boolean;
    tags?: number[];
  },
): void {
  articlesCollection.update(id, (draft) => {
    if (changes.isRead !== undefined) {
      draft.isRead = changes.isRead;
    }
    if (changes.isArchived !== undefined) {
      draft.isArchived = changes.isArchived;
    }
    if (changes.tags !== undefined) {
      draft.tags = changes.tags;
    }
  });
}

/**
 * Manually load more articles (pagination)
 * NOTE: With syncMode: 'on-demand', the collection automatically fetches
 * filtered data when live queries are created. This function is for manual
 * loading if needed, but typically not required.
 */
export async function loadMoreArticles(
  filters?: {
    feedId?: number;
    tagId?: number;
    isRead?: boolean;
    isArchived?: boolean;
    type?: 'all' | 'shorts';
  },
  cursor?: string,
  limit: number = 100,
): Promise<void> {
  const api = useApi();

  const { data, error } = await api.articles.get({
    query: {
      ...filters,
      cursor,
      limit,
    },
  });

  if (error) {
    throw new Error(getErrorMessage(error));
  }

  const newArticles = data?.data || [];

  // Add new items without affecting existing ones
  articlesCollection.utils.writeBatch(() => {
    newArticles.forEach((article) => {
      articlesCollection.utils.writeInsert(article);
    });
  });
}
