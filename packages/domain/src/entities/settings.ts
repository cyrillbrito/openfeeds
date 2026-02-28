import { db, settings as settingsTable, type Db, type Transaction } from '@repo/db';
import { eq } from 'drizzle-orm';
import { assert } from '../errors';
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
export async function getSettings(userId: string, conn: Db | Transaction): Promise<Settings> {
  const settings = await conn.query.settings.findFirst({
    where: eq(settingsTable.userId, userId),
  });

  if (!settings) {
    return {
      userId,
      theme: 'system',
      autoArchiveDays: null,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    userId: settings.userId,
    theme: settings.theme as Settings['theme'],
    autoArchiveDays: settings.autoArchiveDays,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

/**
 * Updates the user's settings (upsert).
 * Pass null for autoArchiveDays to reset to app default.
 */
export async function updateSettings(
  userId: string,
  updates: Partial<Omit<Settings, 'userId'>>,
  conn: Db | Transaction,
): Promise<Settings> {
  const currentSettings = await getSettings(userId, conn);

  // Merge updates - undefined means "don't change"
  const theme = updates.theme !== undefined ? updates.theme : currentSettings.theme;
  const autoArchiveDays =
    updates.autoArchiveDays !== undefined
      ? updates.autoArchiveDays
      : currentSettings.autoArchiveDays;

  const [row] = await conn
    .insert(settingsTable)
    .values({
      userId,
      theme,
      autoArchiveDays,
    })
    .onConflictDoUpdate({
      target: settingsTable.userId,
      set: {
        theme,
        autoArchiveDays,
      },
    })
    .returning();

  assert(row, 'Upserted settings must exist');

  return {
    userId: row.userId,
    theme: row.theme as Settings['theme'],
    autoArchiveDays: row.autoArchiveDays,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Gets the cutoff date for auto-archiving articles based on settings.
 */
export async function getAutoArchiveCutoffDate(userId: string): Promise<Date> {
  const settings = await getSettings(userId, db);
  const days = getEffectiveAutoArchiveDays(settings);
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
