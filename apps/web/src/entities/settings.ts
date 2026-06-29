import { snakeCamelMapper } from '@electric-sql/client';
import { SettingsSchema, type ArchiveResult } from '@repo/domain/client';
import { electricCollectionOptions } from '@tanstack/electric-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/react-db';
import { api, unwrap } from '~/lib/api-client';
import { collectionErrorHandler, shapeErrorHandler } from '~/lib/collection-errors';
import { getShapeUrl, timestampParser } from '~/lib/electric-client';

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
      onError: shapeErrorHandler('settings.shape'),
    },

    onUpdate: collectionErrorHandler('settings.onUpdate', async ({ transaction }) => {
      const updates = transaction.mutations.map((mutation) => mutation.changes);
      return await unwrap(api.api.settings.update.$patch({ json: updates }));
    }),

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
 * Returns the first (and only) settings row for the user, plus loading/error state.
 */
export function useSettings() {
  const { data, isLoading, isError } = useLiveQuery((q) =>
    q.from({ settings: settingsCollection }),
  );
  return { settings: data?.[0], isLoading, isError };
}

/**
 * Trigger auto-archive for old articles based on settings
 */
export async function triggerAutoArchive(): Promise<ArchiveResult> {
  // Electric SQL automatically syncs archived articles
  return await unwrap(api.api.settings['trigger-auto-archive'].$post({}));
}
