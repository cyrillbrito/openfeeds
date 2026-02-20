import { db, feeds } from '@repo/db';
import * as feedsDomain from '@repo/domain';
import { CreateFeedSchema, UpdateFeedSchema } from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$discoverFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ url: z.url() }))
  .handler(({ data }) => {
    return feedsDomain.discoverRssFeeds(data.url);
  });

export const $$importOpml = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ opmlContent: z.string() }))
  .handler(({ context, data }) => {
    return feedsDomain.importOpmlFeeds(data.opmlContent, context.user.id);
  });

export const $$exportOpml = createServerFn()
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return feedsDomain.exportOpmlFeeds(context.user.id);
  });

export const $$hasAnyFeeds = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const feed = await db.query.feeds.findFirst({
      columns: { id: true },
      where: eq(feeds.userId, context.user.id),
    });
    return feed !== undefined;
  });

export const $$createFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(CreateFeedSchema))
  .handler(({ context, data }) => {
    return Promise.all(data.map((feed) => feedsDomain.createFeed(feed, context.user.id)));
  });

export const $$updateFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFeedSchema.extend({ id: z.string() })))
  .handler(({ context, data }) => {
    return Promise.all(
      data.map(({ id, ...updates }) => feedsDomain.updateFeed(id, updates, context.user.id)),
    );
  });

export const $$deleteFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.string()))
  .handler(({ context, data: ids }) => {
    return Promise.all(ids.map((id) => feedsDomain.deleteFeed(id, context.user.id)));
  });

export const $$retryFeed = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ context, data }) => {
    return feedsDomain.retryFeed(data.id, context.user.id);
  });

export const $$getFeedSyncLogs = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ feedId: z.string() }))
  .handler(({ context, data }) => {
    return feedsDomain.getFeedSyncLogs(context.user.id, data.feedId, 200);
  });
