import { db, settings as settingsTable } from '@repo/db';
import { eq } from 'drizzle-orm';
import { getEffectiveAutoArchiveDays, type Settings } from './settings.schema';

// Re-export schemas and types from schema file
export * from './settings.schema';

/**
 * Creates settings row for a new user.
 * Called when a user signs up.
 */
export async function createSettings(userId: string): Promise<void> {
  await db.insert(settingsTable).values({ userId });
}

/**
 * Gets the user's settings.
 * Returns default values if no row exists.
 */
export async function getSettings(userId: string): Promise<Settings> {
  const settings = await db.query.settings.findFirst({
    where: eq(settingsTable.userId, userId),
  });

  if (!settings) {
    return {
      userId,
      theme: 'system',
      autoArchiveDays: null,
    };
  }

  return {
    userId: settings.userId,
    theme: settings.theme as Settings['theme'],
    autoArchiveDays: settings.autoArchiveDays,
  };
}

/**
 * Updates the user's settings (upsert).
 * Pass null for autoArchiveDays to reset to app default.
 */
export async function updateSettings(
  userId: string,
  updates: Partial<Omit<Settings, 'userId'>>,
): Promise<Settings> {
  const currentSettings = await getSettings(userId);

  // Merge updates - undefined means "don't change"
  const newSettings: Settings = {
    userId,
    theme: updates.theme !== undefined ? updates.theme : currentSettings.theme,
    autoArchiveDays:
      updates.autoArchiveDays !== undefined
        ? updates.autoArchiveDays
        : currentSettings.autoArchiveDays,
  };

  await db
    .insert(settingsTable)
    .values({
      userId,
      theme: newSettings.theme,
      autoArchiveDays: newSettings.autoArchiveDays,
    })
    .onConflictDoUpdate({
      target: settingsTable.userId,
      set: {
        theme: newSettings.theme,
        autoArchiveDays: newSettings.autoArchiveDays,
      },
    });

  return newSettings;
}

/**
 * Gets the cutoff date for auto-archiving articles based on settings.
 */
export async function getAutoArchiveCutoffDate(userId: string): Promise<Date> {
  const settings = await getSettings(userId);
  const days = getEffectiveAutoArchiveDays(settings);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
