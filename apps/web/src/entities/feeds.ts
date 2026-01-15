import { dbProvider } from '@repo/domain';
import * as feedsDomain from '@repo/domain';
import { CreateFeedSchema, FeedSchema, UpdateFeedSchema } from '@repo/shared/schemas';
import type { DiscoveredFeed, Feed } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { queryClient } from '~/query-client';
import { authMiddleware } from '~/server/middleware/auth';

export const $$discoverFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(({ data }) => {
    return feedsDomain.discoverRssFeeds(data.url);
  });

export async function discoverFeeds(url: string): Promise<DiscoveredFeed[]> {
  return $$discoverFeeds({ data: { url } });
}

export const $$importOpml = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ opmlContent: z.string() }))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return feedsDomain.importOpmlFeeds(data.opmlContent, context.user.id, db);
  });

export async function importOpml(opmlContent: string) {
  return $$importOpml({ data: { opmlContent } });
}

const $$getAllFeeds = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return feedsDomain.getAllFeeds(db);
  });

const $$createFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFeedSchema))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map((feed) => feedsDomain.createFeed(feed, context.user.id, db)));
  });

const $$updateFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFeedSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(data.map(({ id, ...updates }) => feedsDomain.updateFeed(id, updates, db)));
  });

const $$deleteFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    const db = dbProvider.userDb(context.user.id);
    return Promise.all(ids.map((id) => feedsDomain.deleteFeed(id, db)));
  });

// Feeds Collection
export const feedsCollection = createCollection(
  queryCollectionOptions({
    id: 'feeds',
    queryKey: ['feeds'],
    queryClient,
    getKey: (item: Feed) => item.id,
    schema: FeedSchema,
    queryFn: () => $$getAllFeeds(),

    onInsert: async ({ transaction }) => {
      const feeds = transaction.mutations.map((mutation) => {
        const feed = mutation.modified;
        return { url: feed.url };
      });
      await $$createFeeds({ data: feeds });
    },

    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => ({
        id: mutation.key as string,
        ...mutation.changes,
      }));
      await $$updateFeeds({ data: updates });
    },

    onDelete: async ({ transaction }) => {
      const ids = transaction.mutations.map((mutation) => mutation.key as string);
      await $$deleteFeeds({ data: ids });
    },
  }),
);

export function useFeeds() {
  return useLiveQuery((q) => q.from({ feed: feedsCollection }));
}
