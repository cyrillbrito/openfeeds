import { z } from 'zod';

/**
 * Settings schema - autoArchiveDays is nullable (null = use app default)
 */
export const SettingsSchema = z.object({
  userId: z.string(),
  theme: z.enum(['light', 'dark', 'system']),
  autoArchiveDays: z.number().min(1).max(365).nullable(),
});

/**
 * For updates - can set autoArchiveDays to null to reset to default.
 * userId comes from auth, not request body.
 */
export const UpdateSettingsSchema = SettingsSchema.omit({ userId: true }).partial();

export const ArchiveResultSchema = z.object({
  markedCount: z.number(),
  cutoffDate: z.iso.datetime(),
});
