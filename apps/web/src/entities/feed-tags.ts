import { snakeCamelMapper } from '@electric-sql/client';
import { FeedTagSchema } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { getShapeUrl } from '~/lib/electric-client';
import { $$createFeedTags, $$deleteFeedTags } from './feed-tags.server';

// Feed Tags Collection (junction table for local-first joins) - Electric-powered real-time sync
export const feedTagsCollection = createCollection(
  electricCollectionOptions({
    id: 'feed-tags',
    schema: FeedTagSchema,
    getKey: (item) => item.id,

    shapeOptions: {
      url: getShapeUrl('feed-tags'),
      columnMapper: snakeCamelMapper(),
    },

    onInsert: async ({ transaction }) => {
      const tags = transaction.mutations.map((mutation) => {
        const tag = mutation.modified;
        return { feedId: tag.feedId, tagId: tag.tagId };
      });
      await $$createFeedTags({ data: tags });
    },

    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key as string);
      await $$deleteFeedTags({ data: ids });
    },
  }),
);

export function useFeedTags() {
  return useLiveQuery((q) => q.from({ feedTag: feedTagsCollection }));
}
