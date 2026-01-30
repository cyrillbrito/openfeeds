import { snakeCamelMapper } from '@electric-sql/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection } from '@tanstack/solid-db';
import { z } from 'zod';
import { getShapeUrl } from '~/lib/electric-client';
import { $$createArticle, $$updateArticles } from './articles.server';

// Schema matching application format (camelCase)
// Electric returns snake_case from DB, columnMapper converts to camelCase
// Note: `hasCleanContent` is a computed field, not in DB
const ElectricArticleSchema = z.object({
  id: z.string(),
  feedId: z.string().nullable(),
  title: z.string(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  author: z.string().nullable(),
  pubDate: z.coerce.date().nullable(),
  isRead: z.boolean().nullable(),
  isArchived: z.boolean().nullable(),
  cleanContent: z.string().nullable(), // Raw DB column
  createdAt: z.coerce.date(),
  // Add computed field with default for client-side use
  hasCleanContent: z.boolean().optional().default(false),
});

// Articles Collection - Electric-powered real-time sync
export const articlesCollection = createCollection(
  electricCollectionOptions({
    id: 'articles',
    schema: ElectricArticleSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('articles'),
      columnMapper: snakeCamelMapper(),
      onError: (error) => {
        console.error('Electric articles sync error:', error);
      },
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
            },
          });

          // Write directly to synced data store without triggering onUpdate
          articlesCollection.utils.writeUpdate({
            id: mutation.key as string,
            title: article.title,
            description: article.description,
            content: article.content,
            author: article.author,
            pubDate: article.pubDate ?? new Date().toISOString(),
            hasCleanContent: article.hasCleanContent,
            createdAt: article.createdAt,
          });
        }
      }
    },

    // Handle client-side updates (isRead, isArchived)
    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => {
        return {
          id: mutation.key as string,
          isRead: mutation.changes.isRead ?? undefined,
          isArchived: mutation.changes.isArchived ?? undefined,
        };
      });
      await $$updateArticles({ data: updates });
    },

    // Articles are archived, not deleted
    onDelete: async () => {},
  }),
);
