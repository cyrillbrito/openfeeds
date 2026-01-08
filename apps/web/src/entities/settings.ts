import {
  dbProvider,
  getUserSettings as domainGetUserSettings,
  performArchiveArticles as domainPerformArchiveArticles,
  updateUserSettings as domainUpdateUserSettings,
} from '@repo/domain';
import { AppSettingsSchema, UpdateSettingsSchema } from '@repo/shared/schemas';
import type { AppSettings, ArchiveResult } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { createServerFn } from '@tanstack/solid-start';
import { queryClient } from '~/query-client';
import { authMiddleware } from '~/server/middleware/auth';
import { z } from 'zod';
import { articlesCollection } from './articles';

// Settings is a singleton - we use a fixed ID
const SETTINGS_ID = 1;

const $$getUserSettings = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return domainGetUserSettings(db);
  });

const $$updateSettings = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.array(UpdateSettingsSchema))
  .handler(({ context, data }) => {
    const db = dbProvider.userDb(context.user.id);
    // Settings is a singleton, so we just take the first update
    const updates = data[0] || {};
    return domainUpdateUserSettings(db, updates);
  });

const $$triggerAutoArchive = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(({ context }) => {
    const db = dbProvider.userDb(context.user.id);
    return domainPerformArchiveArticles(db);
  });

// Extend the schema to include an ID for collection compatibility
const SettingsWithIdSchema = AppSettingsSchema.extend({
  id: z.number(),
});

type SettingsWithId = z.infer<typeof SettingsWithIdSchema>;

// Settings Collection (singleton pattern)
export const settingsCollection = createCollection(
  queryCollectionOptions({
    id: 'settings',
    queryKey: ['settings'],
    queryClient,
    getKey: (item: SettingsWithId) => item.id,
    schema: SettingsWithIdSchema,
    queryFn: async () => {
      const data = await $$getUserSettings();
      return data ? [{ ...data, id: SETTINGS_ID }] : [];
    },

    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations.map(
        (mutation) => mutation.changes as Partial<AppSettings>,
      );
      await $$updateSettings({ data: updates });
    },

    // Settings cannot be inserted or deleted by clients
    onInsert: async () => {
      throw new Error('Settings cannot be created client-side');
    },
    onDelete: async () => {
      throw new Error('Settings cannot be deleted');
    },
  }),
);

/**
 * Hook to get the current settings
 * Returns the settings object directly (unwrapped from array)
 */
export function useSettings() {
  const query = useLiveQuery((q) => q.from({ settings: settingsCollection }));

  return {
    get data() {
      const item = query.data?.[0];
      if (!item) return undefined;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...settings } = item;
      return settings as AppSettings;
    },
    get isLoading() {
      return query.isLoading();
    },
    get isError() {
      return query.isError();
    },
  };
}

/**
 * Trigger auto-archive for old articles based on settings
 */
export async function triggerAutoArchive(): Promise<ArchiveResult> {
  const result = await $$triggerAutoArchive();

  // Refetch articles to reflect archived status
  articlesCollection.utils.refetch();

  return result;
}
