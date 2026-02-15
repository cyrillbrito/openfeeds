import { snakeCamelMapper } from '@electric-sql/client';
import { ArticleTagSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { getShapeUrl } from '~/lib/electric-client';
import { $$createArticleTags, $$deleteArticleTags } from './article-tags.server';

// Article Tags Collection (junction table for local-first joins) - Electric-powered real-time sync
export const articleTagsCollection = createCollection(
  electricCollectionOptions({
    id: 'article-tags',
    schema: ArticleTagSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('article-tags'),
      columnMapper: snakeCamelMapper(),
    },

    onInsert: async ({ transaction }) => {
      const tags = transaction.mutations.map((mutation) => {
        const tag = mutation.modified;
        return { id: mutation.key as string, articleId: tag.articleId, tagId: tag.tagId };
      });
      await $$createArticleTags({ data: tags });
    },

    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key as string);
      await $$deleteArticleTags({ data: ids });
    },
  }),
);

export function useArticleTags() {
  return useLiveQuery((q) => q.from({ articleTag: articleTagsCollection }));
}
