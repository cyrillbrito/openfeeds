import { ArticleWithContentSchema } from '@repo/shared/schemas';
import type { ArticleWithContent } from '@repo/shared/types';
import { eq } from '@tanstack/db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { useApi } from '../hooks/api';
import { queryClient } from '../routes/__root';
import { getErrorMessage } from './utils';

/**
 * Article Details Collection
 *
 * On-demand, read-only collection for fetching detailed article data (with cleanContent).
 * Always loaded one at a time by ID for the article detail view.
 */
export const articleDetailsCollection = createCollection(
  queryCollectionOptions({
    id: 'article-details',
    queryKey: ['article-details'],
    queryClient,
    getKey: (item: ArticleWithContent) => item.id,
    schema: ArticleWithContentSchema,
    syncMode: 'on-demand',

    queryFn: async (ctx) => {
      const api = useApi();
      const { signal } = ctx;

      // Parse the ID filter from live query
      const loadSubsetOptions = ctx.meta?.loadSubsetOptions as { where?: any } | undefined;

      // Extract article ID from filters
      let articleId: number | undefined;
      if (loadSubsetOptions?.where) {
        const filters = loadSubsetOptions.where;
        // The filter structure from eq(article.id, value) creates a filter we need to parse
        if (Array.isArray(filters)) {
          for (const filter of filters) {
            if (filter.field?.[1] === 'id' && filter.operator === 'eq') {
              articleId = filter.value;
              break;
            }
          }
        }
      }

      if (!articleId) {
        // No ID filter - return empty (shouldn't happen in normal usage)
        return [];
      }

      const { data, error } = await api.articles({ id: articleId }).get({
        fetch: { signal },
      });

      if (error) {
        throw new Error(getErrorMessage(error));
      }

      // Return as array for collection
      return data ? [data] : [];
    },

    // Read-only collection - mutations go through articlesCollection
    onInsert: async () => {
      throw new Error('articleDetailsCollection is read-only');
    },

    onUpdate: async () => {
      throw new Error('articleDetailsCollection is read-only - use articlesCollection for updates');
    },

    onDelete: async () => {
      throw new Error('articleDetailsCollection is read-only');
    },
  }),
);

/**
 * Hook to fetch detailed article data by ID
 * Returns article with cleanContent for the reader view
 */
export function useArticleDetails(articleId: () => number) {
  return useLiveQuery((q) =>
    q
      .from({ article: articleDetailsCollection })
      .where(({ article }) => eq(article.id, articleId()))
      .select(({ article }) => article),
  );
}
