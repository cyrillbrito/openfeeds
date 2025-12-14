import { z } from 'zod';

export const AppSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']),
  autoArchiveDays: z.number().min(1).max(365),
});

export const UpdateSettingsSchema = AppSettingsSchema.partial();

export const ArchiveResultSchema = z.object({
  markedCount: z.number(),
  cutoffDate: z.iso.datetime(),
});
