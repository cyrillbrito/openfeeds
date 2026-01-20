import { ArticleTagSchema } from '@repo/shared/schemas';
import type { ArticleTag } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { $$getAllArticleTags } from './article-tags.server';

// Article Tags Collection (junction table for local-first joins)
export const articleTagsCollection = createCollection(
  queryCollectionOptions({
    id: 'article-tags',
    queryKey: ['article-tags'],
    queryClient,
    getKey: (item: ArticleTag) => item.id,
    schema: ArticleTagSchema,
    queryFn: async () => (await $$getAllArticleTags()) ?? [],
  }),
);

export function useArticleTags() {
  return useLiveQuery((q) => q.from({ articleTag: articleTagsCollection }));
}
