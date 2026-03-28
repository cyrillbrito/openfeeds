import { snakeCamelMapper } from '@electric-sql/client';
import { ArticleSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection } from '@tanstack/solid-db';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
import { $$createArticles, $$updateArticles } from './articles.functions';

// Articles Collection - Electric-powered real-time sync
export const articlesCollection = createCollection(
  electricCollectionOptions({
    id: 'articles',
    schema: ArticleSchema,
    getKey: (item) => item.id,

    // autoIndex: 'eager' restores the pre-0.6 default, which was changed to 'off'.
    // It auto-creates B-tree indexes for fields used in orderBy/where at query time.
    // TODO: consider switching to explicit createIndex calls per field for more control
    //       over memory usage (avoids surprise indexes from transient queries).
    autoIndex: 'eager' as const,
    defaultIndexType: BasicIndex,

    shapeOptions: {
      url: getShapeUrl('articles'),
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: shapeErrorHandler('articles.shape'),
    },

    onInsert: collectionErrorHandler('articles.onInsert', async ({ transaction }) => {
      const articles = transaction.mutations
        .filter((mutation) => mutation.modified.feedId === null && mutation.modified.url)
        .map((mutation) => ({
          id: mutation.key as string,
          url: mutation.modified.url!,
        }));

      if (articles.length === 0) return;
      return await $$createArticles({ data: articles });
    }),

    onUpdate: collectionErrorHandler('articles.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: mutation.key as string,
        isRead: mutation.changes.isRead,
        isArchived: mutation.changes.isArchived,
      }));
      return await $$updateArticles({ data: updates });
    }),

    // Articles are archived, not deleted
    onDelete: async () => {},
  }),
);
