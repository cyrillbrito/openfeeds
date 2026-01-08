import { dbProvider } from '@repo/domain';
import * as articleTagsDomain from '@repo/domain';
import { ArticleTagSchema } from '@repo/shared/schemas';
import type { ArticleTag } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { createServerFn } from '@tanstack/solid-start';
import { queryClient } from '~/query-client';
import { authMiddleware } from '~/server/middleware/auth';

const $$getAllArticleTags = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return articleTagsDomain.getAllArticleTags(db);
  });

// Article Tags Collection (junction table for local-first joins)
export const articleTagsCollection = createCollection(
  queryCollectionOptions({
    id: 'article-tags',
    queryKey: ['article-tags'],
    queryClient,
    getKey: (item: ArticleTag) => item.id,
    schema: ArticleTagSchema,
    queryFn: () => $$getAllArticleTags(),
  }),
);

export function useArticleTags() {
  return useLiveQuery((q) => q.from({ articleTag: articleTagsCollection }));
}
