import { db, feeds, getTxId } from '@repo/db';
import * as feedsDomain from '@repo/domain';
import {
  CreateFeedSchema,
  feedUrlSchema,
  FollowFeedsWithTagsSchema,
  UpdateFeedSchema,
  withTransaction,
} from '@repo/domain';
import type { Plan } from '@repo/domain/client';
import { createServerFn } from '@tanstack/solid-start';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$discoverFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ url: feedUrlSchema }))
  .handler(({ data }) => {
    return feedsDomain.discoverRssFeeds(data.url);
  });

export const $$importOpml = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ opmlContent: z.string() }))
  .handler(({ context, data }) => {
    return withTransaction(db, context.user.id, context.user.plan as Plan, (ctx) =>
      feedsDomain.importOpmlFeeds(ctx, data.opmlContent),
    );
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
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan as Plan, async (ctx) => {
      await feedsDomain.createFeeds(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$updateFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateFeedSchema))
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan as Plan, async (ctx) => {
      await feedsDomain.updateFeeds(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$deleteFeeds = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(z.uuidv7()))
  .handler(async ({ context, data: ids }) => {
    return await withTransaction(db, context.user.id, context.user.plan as Plan, async (ctx) => {
      await feedsDomain.deleteFeeds(ctx, ids);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$retryFeed = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ id: z.uuidv7() }))
  .handler(({ context, data }) => {
    return feedsDomain.retryFeed(data.id, context.user.id);
  });

export const $$getFeedSyncLogs = createServerFn()
  .middleware([authMiddleware])
  .inputValidator(z.object({ feedId: z.uuidv7() }))
  .handler(({ context, data }) => {
    return feedsDomain.getFeedSyncLogs(context.user.id, data.feedId, 200);
  });

export const $$followFeedsWithTags = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(FollowFeedsWithTagsSchema)
  .handler(async ({ context, data }) => {
    return await withTransaction(db, context.user.id, context.user.plan as Plan, async (ctx) => {
      await feedsDomain.followFeedsWithTags(ctx, data);
      return { txid: await getTxId(ctx.conn) };
    });
  });
