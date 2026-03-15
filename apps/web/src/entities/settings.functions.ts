import { db, getTxId } from '@repo/db';
import {
  createDomainContext,
  getSettings as domainGetSettings,
  getUserUsage as domainGetUserUsage,
  performArchiveArticles as domainPerformArchiveArticles,
  updateSettings as domainUpdateSettings,
  UpdateSettingsSchema,
  withTransaction,
} from '@repo/domain';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return domainGetSettings(context.user.id, db);
  });

export const $$updateSettings = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateSettingsSchema))
  .handler(async ({ context, data }) => {
    // Settings is a singleton, so we just take the first update
    const updates = data[0] || {};
    return await withTransaction(db, context.user.id, context.user.plan, async (ctx) => {
      await domainUpdateSettings(ctx, updates);
      return { txid: await getTxId(ctx.conn) };
    });
  });

export const $$triggerAutoArchive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const ctx = createDomainContext(db, context.user.id, context.user.plan);
    return domainPerformArchiveArticles(ctx);
  });

export const $$getUserUsage = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return domainGetUserUsage(context.user.id, context.user.plan);
  });
