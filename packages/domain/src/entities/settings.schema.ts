import { z } from 'zod';

/**
 * Settings schema - autoArchiveDays is nullable (null = use app default)
 */
export const SettingsSchema = z.object({
  userId: z.string(),
  theme: z.enum(['light', 'dark', 'system']),
  autoArchiveDays: z.number().min(1).max(365).nullable(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/**
 * For updates - can set autoArchiveDays to null to reset to default.
 * userId comes from auth, not request body.
 */
export const UpdateSettingsSchema = SettingsSchema.omit({ userId: true }).partial();

export interface ArchiveResult {
  markedCount: number;
  cutoffDate: string;
}

/** App-level default for autoArchiveDays */
export const DEFAULT_AUTO_ARCHIVE_DAYS = 30;

/** Get effective autoArchiveDays value (with default applied) */
export function getEffectiveAutoArchiveDays(settings: Settings): number {
  return settings.autoArchiveDays ?? DEFAULT_AUTO_ARCHIVE_DAYS;
}

/** Check if autoArchiveDays is using app default */
export function isAutoArchiveDaysDefault(settings: Settings): boolean {
  return settings.autoArchiveDays === null;
}
