import { z } from 'zod';

export const SyncStatusSchema = z.enum(['ok', 'failing', 'broken']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const FeedSchema = z.object({
  id: z.string(),
  url: z.string(),
  feedUrl: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastSyncAt: z.iso.datetime().nullable(),
  syncStatus: SyncStatusSchema,
  syncError: z.string().nullable(),
  syncFailCount: z.number(),
});
export type Feed = z.infer<typeof FeedSchema>;

export const CreateFeedSchema = z.object({
  url: z.url(),
});
export type CreateFeed = z.infer<typeof CreateFeedSchema>;

export const UpdateFeedSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  url: z.url().optional(),
  icon: z.string().nullable().optional(),
});
export type UpdateFeed = z.infer<typeof UpdateFeedSchema>;

export const DiscoveredFeedSchema = z.object({
  url: z.string(),
  title: z.string(),
  type: z.string().optional(),
});
export type DiscoveredFeed = z.infer<typeof DiscoveredFeedSchema>;
