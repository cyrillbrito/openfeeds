import { snakeCamelMapper } from '@electric-sql/client';
import { ElectricArticleSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection } from '@tanstack/solid-db';
import { handleCollectionError } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import { $$createArticle, $$updateArticles } from './articles.server';

// Articles Collection - Electric-powered real-time sync
export const articlesCollection = createCollection(
  electricCollectionOptions({
    id: 'articles',
    schema: ElectricArticleSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('articles'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: (error) => {
        console.error('Electric articles sync error:', error);
      },
    },

    onInsert: async ({ transaction }) => {
      try {
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
      } catch (error) {
        handleCollectionError(error, 'articles.onInsert');
      }
    },

    // Handle client-side updates (isRead, isArchived)
    onUpdate: async ({ transaction }) => {
      try {
        const updates = transaction.mutations.map((mutation) => {
          return {
            id: mutation.key as string,
            isRead: mutation.changes.isRead ?? undefined,
            isArchived: mutation.changes.isArchived ?? undefined,
          };
        });
        await $$updateArticles({ data: updates });
      } catch (error) {
        handleCollectionError(error, 'articles.onUpdate');
      }
    },

    // Articles are archived, not deleted
    onDelete: async () => {},
  }),
);
