import { snakeCamelMapper } from '@electric-sql/client';
import { AppSettingsSchema } from '@repo/shared/schemas';
import type { AppSettings, ArchiveResult } from '@repo/shared/types';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { z } from 'zod';
import { getShapeUrl } from '~/lib/electric-client';
import { articlesCollection } from './articles';
import { $$triggerAutoArchive, $$updateSettings } from './settings.server';

// Extend the schema to include an ID for collection compatibility
const SettingsWithIdSchema = AppSettingsSchema.extend({
  id: z.number(),
});

type SettingsWithId = z.infer<typeof SettingsWithIdSchema>;

// Settings Collection (singleton pattern) - Electric-powered real-time sync
export const settingsCollection = createCollection(
  electricCollectionOptions({
    id: 'settings',
    schema: SettingsWithIdSchema,
    getKey: (item: SettingsWithId) => item.id,

    shapeOptions: {
      url: getShapeUrl('settings'),
      columnMapper: snakeCamelMapper(),
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
      const { id: _id, ...settings } = item;
      return settings as AppSettings;
    },
    get isLoading() {
      return query.isLoading;
    },
    get isError() {
      return query.isError;
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
