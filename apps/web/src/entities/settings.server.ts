import { getUserDb } from '@repo/db';
import {
  getUserSettings as domainGetUserSettings,
  performArchiveArticles as domainPerformArchiveArticles,
  updateUserSettings as domainUpdateUserSettings,
} from '@repo/domain';
import { UpdateSettingsSchema } from '@repo/shared/schemas';
import { createServerFn } from '@tanstack/solid-start';
import { z } from 'zod';
import { authMiddleware } from '~/server/middleware/auth';

export const $$getUserSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = getUserDb(context.user.id);
    return domainGetUserSettings(db);
  });

export const $$updateSettings = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateSettingsSchema))
  .handler(({ context, data }) => {
    const db = getUserDb(context.user.id);
    // Settings is a singleton, so we just take the first update
    const updates = data[0] || {};
    return domainUpdateUserSettings(db, updates);
  });

export const $$triggerAutoArchive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = getUserDb(context.user.id);
    return domainPerformArchiveArticles(db);
  });
