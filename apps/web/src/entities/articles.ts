import { snakeCamelMapper } from '@electric-sql/client';
import { ArticleSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection } from '@tanstack/solid-db';
import {
  attachCollectionChangeLogger,
  collectionErrorHandler,
  shapeErrorHandler,
} from '~/lib/collection-errors';
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
          id: String(mutation.key),
          url: mutation.modified.url!,
        }));

      if (articles.length === 0) return undefined;
      return await $$createArticles({ data: articles });
    }),

    onUpdate: collectionErrorHandler(
      'articles.onUpdate',
      async ({ transaction }, { mutationId }) => {
        const updates = transaction.mutations.map((mutation) => ({
          id: String(mutation.key),
          ...mutation.changes,
        }));
        // Thread the client-side mutationId through to the server as a header so
        // server-side PostHog events (`server:mutation_ok`) can be joined with
        // the client-side `mutation:*` events when investigating the
        // "archive comes back" bug.
        return await $$updateArticles({
          data: updates,
          headers: { 'x-mutation-id': mutationId },
        });
      },
    ),

    // Articles are archived, not deleted
    onDelete: async () => {},
  }),
);

// Diagnostic: log every change observed in the articles store, including
// virtual props ($synced, $origin). Used to investigate the "archive comes
// back" bug — we want to see whether a sync message overwrites our confirmed
// archive with a stale row. Cheap (it's just a passive subscriber); leave on
// in production until the bug is fully understood, then remove or gate behind
// a debug flag.
if (typeof window !== 'undefined') {
  attachCollectionChangeLogger('articles', articlesCollection, {
    fields: ['id', 'isRead', 'isArchived'],
  });
}
