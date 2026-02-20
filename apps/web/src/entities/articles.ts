import { snakeCamelMapper } from '@electric-sql/client';
import { ArticleSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection } from '@tanstack/solid-db';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import { $$createArticle, $$updateArticles } from './articles.server';

// Articles Collection - Electric-powered real-time sync
export const articlesCollection = createCollection(
  electricCollectionOptions({
    id: 'articles',
    schema: ArticleSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('articles'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('articles.shape'),
    },

    onInsert: collectionErrorHandler('articles.onInsert', async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map(async (mutation) => {
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
              cleanContent: article.cleanContent,
              contentExtractedAt: article.contentExtractedAt,
              createdAt: article.createdAt,
            });
          }
        }),
      );
    }),

    // Handle client-side updates (isRead, isArchived)
    onUpdate: collectionErrorHandler('articles.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => {
        return {
          id: mutation.key as string,
          isRead: mutation.changes.isRead ?? undefined,
          isArchived: mutation.changes.isArchived ?? undefined,
        };
      });
      await $$updateArticles({ data: updates });
    }),

    // Articles are archived, not deleted
    onDelete: async () => {},
  }),
);
