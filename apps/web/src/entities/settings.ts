import { snakeCamelMapper } from '@electric-sql/client';
import { SettingsSchema, type ArchiveResult, type Settings } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { handleCollectionError, handleShapeError } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';
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
      parser: timestampParser,
      columnMapper: snakeCamelMapper(),
      onError: (error) => handleShapeError(error, 'settings.shape'),
    },

    onUpdate: async ({ transaction }) => {
      try {
        const updates = transaction.mutations.map(
          (mutation) => mutation.changes as Partial<Settings>,
        );
        await $$updateSettings({ data: updates });
      } catch (error) {
        handleCollectionError(error, 'settings.onUpdate');
      }
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
 * Returns a callable that provides the first (and only) settings row for the user.
 * Also exposes `.isLoading` and `.isError` properties.
 */
export function useSettings() {
  const query = useLiveQuery((q) => q.from({ settings: settingsCollection }));

  const accessor = () => query()?.[0];

  Object.defineProperty(accessor, 'isLoading', {
    get: () => query.isLoading,
  });
  Object.defineProperty(accessor, 'isError', {
    get: () => query.isError,
  });

  return accessor as typeof accessor & { isLoading: boolean; isError: boolean };
}

/**
 * Trigger auto-archive for old articles based on settings
 */
export async function triggerAutoArchive(): Promise<ArchiveResult> {
  // Electric SQL automatically syncs archived articles
  return await $$triggerAutoArchive();
}
