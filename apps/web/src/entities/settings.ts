import { snakeCamelMapper } from '@electric-sql/client';
import { SettingsSchema } from '@repo/shared/schemas';
import type { ArchiveResult, Settings } from '@repo/shared/types';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { getShapeUrl } from '~/lib/electric-client';
import { $$triggerAutoArchive, $$updateSettings } from './settings.server';

// Settings Collection - Electric-powered real-time sync
// One row per user, userId is the primary key
export const settingsCollection = createCollection(
  electricCollectionOptions({
    id: 'settings',
    schema: SettingsSchema,
    getKey: (item) => item.userId,

    shapeOptions: {
      url: getShapeUrl('settings'),
      columnMapper: snakeCamelMapper(),
    },

    onUpdate: async ({ transaction }) => {
      const updates = transaction.mutations.map(
        (mutation) => mutation.changes as Partial<Settings>,
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
 * Hook to get the current user settings.
 * Returns the first (and only) settings row for the user.
 */
export function useSettings() {
  const query = useLiveQuery((q) => q.from({ settings: settingsCollection }));

  return {
    get data() {
      return query()?.[0];
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
  // Electric SQL automatically syncs archived articles
  return await $$triggerAutoArchive();
}
