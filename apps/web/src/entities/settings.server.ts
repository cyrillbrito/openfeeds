import { db, getTxId } from '@repo/db';
import {
  getSettings as domainGetSettings,
  getUserUsage as domainGetUserUsage,
  performArchiveArticles as domainPerformArchiveArticles,
  updateSettings as domainUpdateSettings,
  UpdateSettingsSchema,
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
    return await db.transaction(async (tx) => {
      await domainUpdateSettings(context.user.id, updates, tx);
      return { txid: await getTxId(tx) };
    });
  });

export const $$triggerAutoArchive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return domainPerformArchiveArticles(context.user.id);
  });

export const $$getUserUsage = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    return domainGetUserUsage(context.user.id);
  });
