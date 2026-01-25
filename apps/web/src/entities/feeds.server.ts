import { getUserDb } from '@repo/db';
import * as feedsDomain from '@repo/domain';
import { CreateFeedSchema, UpdateFeedSchema } from '@repo/shared/schemas';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$discoverFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ url: z.string().url() }))
  .handler(({ data }) => {
    return feedsDomain.discoverRssFeeds(data.url);
  });

export const $$importOpml = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ opmlContent: z.string() }))
  .handler(({ context, data }) => {
    const db = getUserDb(context.user.id);
    return feedsDomain.importOpmlFeeds(data.opmlContent, context.user.id, db);
  });

export const $$getAllFeeds = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = getUserDb(context.user.id);
    return feedsDomain.getAllFeeds(db);
  });

export const $$createFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFeedSchema))
  .handler(({ context, data }) => {
    const db = getUserDb(context.user.id);
    return Promise.all(data.map((feed) => feedsDomain.createFeed(feed, context.user.id, db)));
  });

export const $$updateFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFeedSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    const db = getUserDb(context.user.id);
    return Promise.all(data.map(({ id, ...updates }) => feedsDomain.updateFeed(id, updates, db)));
  });

export const $$deleteFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    const db = getUserDb(context.user.id);
    return Promise.all(ids.map((id) => feedsDomain.deleteFeed(id, db)));
  });
