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
    return domainGetSettings(context.user.id);
  });

export const $$updateSettings = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateSettingsSchema))
  .handler(({ context, data }) => {
    // Settings is a singleton, so we just take the first update
    const updates = data[0] || {};
    return domainUpdateSettings(context.user.id, updates);
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
