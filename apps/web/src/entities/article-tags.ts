import { ArticleTagSchema } from '@repo/shared/schemas';
import type { ArticleTag } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { useApi } from '../hooks/api';
import { getErrorMessage } from './utils';

// Article Tags Collection (junction table for local-first joins)
export const articleTagsCollection = createCollection(
  queryCollectionOptions({
    id: 'article-tags',
    queryKey: ['article-tags'],
    queryClient,
    getKey: (item: ArticleTag) => item.id,
    schema: ArticleTagSchema,
    queryFn: async ({ signal }) => {
      const api = useApi();
      const { data, error } = await api['article-tags'].get({ fetch: { signal } });
      if (error) {
        throw new Error(getErrorMessage(error));
      }
      return data || [];
    },
  }),
);

export function useArticleTags() {
  return useLiveQuery((q) => q.from({ articleTag: articleTagsCollection }));
}
