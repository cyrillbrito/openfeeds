import { AppSettingsSchema } from '@repo/shared/schemas';
import type { AppSettings, ArchiveResult } from '@repo/shared/types';
import { queryCollectionOptions } from '@tanstack/query-db-collection';
import { createCollection, useLiveQuery } from '@tanstack/solid-db';
import { queryClient } from '~/query-client';
import { z } from 'zod';
import { useApi } from '../hooks/api';
import { articlesCollection } from './articles';
import { getErrorMessage } from './utils';

// Settings is a singleton - we use a fixed ID
const SETTINGS_ID = 1;

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
    queryFn: async ({ signal }) => {
      const api = useApi();
      const { data, error } = await api.settings.get({ fetch: { signal } });
      if (error) {
        throw new Error(getErrorMessage(error));
      }
      // Wrap the singleton settings in an array with ID
      return data ? [{ ...data, id: SETTINGS_ID }] : [];
    },

    onUpdate: async ({ transaction }) => {
      const api = useApi();
      await Promise.all(
        transaction.mutations.map(async (mutation) => {
          const changes = mutation.changes as Partial<AppSettings>;
          const { data, error } = await api.settings.put(changes);
          if (error) {
            throw new Error(getErrorMessage(error));
          }
          return data;
        }),
      );
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
 * Update application settings
 * Applies optimistic update immediately - UI updates via live queries
 */
export function updateSettings(changes: Partial<AppSettings>): void {
  settingsCollection.update(SETTINGS_ID, (draft) => {
    if (changes.theme !== undefined) {
      draft.theme = changes.theme;
    }
    if (changes.autoArchiveDays !== undefined) {
      draft.autoArchiveDays = changes.autoArchiveDays;
    }
  });
}

/**
 * Trigger auto-archive for old articles based on settings
 */
export async function triggerAutoArchive(): Promise<ArchiveResult> {
  const api = useApi();

  const { data, error } = await api.settings['auto-archive'].post();
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  // Refetch articles to reflect archived status
  articlesCollection.utils.refetch();

  return data;
}
