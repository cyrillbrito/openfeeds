import { ArticleSchema } from '@repo/shared/schemas';
import type { Article, CreateArticleFromUrl } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, parseLoadSubsetOptions } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { $$createArticle, $$getArticles, $$updateArticles } from './articles.server';

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
      // Parse filters from live queries
      const loadSubsetOptions = ctx.meta?.loadSubsetOptions as
        | { where?: any; orderBy?: any; limit?: number }
        | undefined;
      const parsed = parseLoadSubsetOptions({
        where: loadSubsetOptions?.where,
        orderBy: loadSubsetOptions?.orderBy,
        limit: loadSubsetOptions?.limit,
      });

      // Build query parameters from parsed filters
      const query: Record<string, any> = {
        limit: parsed.limit || 10000,
      };

      // Map filters to query parameters
      parsed.filters.forEach(({ field, operator, value }) => {
        const fieldName = field[field.length - 1];
        if (operator === 'eq') {
          query[fieldName] = value;
        }
      });

      const result = await $$getArticles({ data: query });
      return result?.data || [];
    },

    // Article creation is handled by createArticleFromUrl() below
    // which calls the server and then inserts the result
    onInsert: async () => {},

    // Handle client-side updates (isRead, isArchived, tags)
    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => {
        return {
          id: mutation.key as string,
          isRead: mutation.changes.isRead ?? undefined,
          isArchived: mutation.changes.isArchived ?? undefined,
          tags: mutation.changes.tags ?? undefined,
        };
      });
      await $$updateArticles({ data: updates });
    },

    // Articles are archived, not deleted
    onDelete: async () => {},
  }),
);

/**
 * Create an article from a URL and insert it into the collection
 */
export async function createArticleFromUrl(data: CreateArticleFromUrl): Promise<Article> {
  // Call server to create the article (extracts content via Readability)
  const article = await $$createArticle({ data });

  // Insert into collection for local state
  articlesCollection.insert({
    id: article.id,
    feedId: null,
    title: article.title,
    url: article.url,
    description: article.description,
    content: article.content,
    author: article.author,
    pubDate: article.pubDate?.toISOString() ?? new Date().toISOString(),
    isRead: article.isRead ?? false,
    isArchived: article.isArchived ?? false,
    hasCleanContent: article.hasCleanContent,
    tags: article.tags,
    createdAt: article.createdAt.toISOString(),
  });

  return article;
}
