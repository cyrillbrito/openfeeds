import { getDb, settings } from '@repo/db';
import { defaultSettings, type AppSettings } from '@repo/shared/types';
import { and, eq } from 'drizzle-orm';

/**
 * Gets the user's application settings, falling back to defaults if not found
 */
export async function getUserSettings(userId: string): Promise<AppSettings> {
  const db = getDb();
  const defaultSetting = await db.query.settings.findFirst({
    where: and(eq(settings.userId, userId), eq(settings.key, 'default')),
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
  userId: string,
  updates: Partial<AppSettings>,
): Promise<AppSettings> {
  const db = getDb();
  const currentSettings = await getUserSettings(userId);
  const newSettings = { ...currentSettings, ...updates };

  await db
    .insert(settings)
    .values({
      userId,
      key: 'default',
      value: newSettings,
    })
    .onConflictDoUpdate({
      target: [settings.userId, settings.key],
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
export async function getAutoArchiveCutoffDate(userId: string): Promise<Date> {
  const userSettings = await getUserSettings(userId);
  const autoArchiveDays = userSettings.autoArchiveDays;
  return new Date(Date.now() - autoArchiveDays * 24 * 60 * 60 * 1000);
}
