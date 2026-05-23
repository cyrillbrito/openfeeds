import { snakeCamelMapper } from '@electric-sql/client';
import { ArticleSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { BasicIndex, createCollection } from '@tanstack/solid-db';
import { api, unwrap } from '~/lib/api-client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';

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
      return await unwrap(api.api.articles.create.$post({ json: articles }));
    }),

    onUpdate: collectionErrorHandler('articles.onUpdate', async ({ transaction }) => {
      // Spread `...mutation.changes` so we only send the fields the caller
      // actually mutated. Sending an explicit `{ isRead, isArchived }` set
      // would include `undefined` for whichever field is unchanged, which
      // older code paths special-cased incorrectly. Matches the pattern used
      // by every other entity (tags, feeds, filter-rules, settings).
      const updates = transaction.mutations.map((mutation) => ({
        id: String(mutation.key),
        ...mutation.changes,
      }));
      return await unwrap(api.api.articles.update.$patch({ json: updates }));
    }),

    // Articles are archived, not deleted
    onDelete: async () => {},
  }),
);
