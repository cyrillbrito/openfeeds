import { dbProvider } from '@repo/domain';
import * as articlesDomain from '@repo/domain';
import {
  ArticleSchema,
  CreateStandaloneArticleSchema,
  UpdateArticleSchema,
} from '@repo/shared/schemas';
import type { Article } from '@repo/shared/types';
import { parseLoadSubsetOptions } from '@tanstack/db';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection } from '@tanstack/solid-db';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { queryClient } from '~/query-client';
import { authMiddleware } from '~/server/middleware/auth';

const ArticleQuerySchema = z.object({
  feedId: z.string().optional(),
  tagId: z.string().optional(),
  isRead: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  type: z.enum(['all', 'shorts']).optional(),
  limit: z.number().optional(),
});

const $$getArticles = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(ArticleQuerySchema)
  .handler(({ context, data: query }) => {
    const db = dbProvider.userDb(context.user.id);
    return articlesDomain.getArticles(query, db);
  });

const $$updateArticles = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateArticleSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(
      data.map(({ id, ...updates }) => articlesDomain.updateArticle(id, updates, db)),
    );
  });

export const $$createStandaloneArticle = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(CreateStandaloneArticleSchema)
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return articlesDomain.createStandaloneArticle(data, db);
  });

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

    // Articles are created server-side via RSS fetch
    // No client-side creation needed
    onInsert: async () => {
      // Not implemented - articles are created by RSS feed sync
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
    // No client-side deletion needed
    onDelete: async () => {
      // Not implemented - articles are typically archived
    },
  }),
);
