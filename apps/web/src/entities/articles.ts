import { ArticleSchema } from '@repo/shared/schemas';
import type { Article } from '@repo/shared/types';
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

    onInsert: async ({ transaction }) => {
      for (const mutation of transaction.mutations) {
        const data = mutation.modified;
        // Only call server for articles created from URL (no feedId)
        if (data.feedId === null && data.url) {
          const article = await $$createArticle({
            data: {
              id: mutation.key as string,
              url: data.url,
              tags: data.tags.length > 0 ? data.tags : undefined,
            },
          });

          // Write directly to synced data store without triggering onUpdate
          articlesCollection.utils.writeUpdate({
            id: mutation.key as string,
            title: article.title,
            description: article.description,
            content: article.content,
            author: article.author,
            pubDate: article.pubDate ?? new Date(),
            hasCleanContent: article.hasCleanContent,
            createdAt: article.createdAt,
          });

          // If tags were assigned, invalidate article-tags collection
          // to force refresh of the local article-tag relationships
          if (data.tags && data.tags.length > 0) {
            queryClient.invalidateQueries({ queryKey: ['article-tags'] });
          }
        }
      }
    },

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
