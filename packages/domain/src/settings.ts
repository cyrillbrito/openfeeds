import { settings, type UserDb } from '@repo/db';
import { defaultSettings, type AppSettings } from '@repo/shared/types';
import { eq } from 'drizzle-orm';

/**
 * Gets the user's application settings, falling back to defaults if not found
 */
export async function getUserSettings(db: UserDb): Promise<AppSettings> {
  const defaultSetting = await db.query.settings.findFirst({
    where: eq(settings.key, 'default'),
  });

  if (!defaultSetting) {
    return defaultSettings;
  }

  // Merge with defaults in case new settings were added
  const userSettings = {
    ...defaultSettings,
    ...(defaultSetting.value as AppSettings),
  };

  return userSettings;
}

/**
 * Updates the user's application settings
 */
export async function updateUserSettings(
  db: UserDb,
  updates: Partial<AppSettings>,
): Promise<AppSettings> {
  const currentSettings = await getUserSettings(db);
  const newSettings = { ...currentSettings, ...updates };

  await db
    .insert(settings)
    .values({
      key: 'default',
      value: newSettings,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: newSettings,
        updatedAt: new Date(),
      },
    });

  return newSettings;
}

/**
 * Gets the cutoff date for auto-archiving articles based on user settings.
 */
export async function getAutoArchiveCutoffDate(db: UserDb): Promise<Date> {
  const userSettings = await getUserSettings(db);
  const autoArchiveDays = userSettings.autoArchiveDays;
  return new Date(Date.now() - autoArchiveDays * 24 * 60 * 60 * 1000);
}
