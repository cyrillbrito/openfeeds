import { z } from 'zod';

export const FeedSchema = z.object({
  id: z.string(),
  url: z.string(),
  feedUrl: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastSyncAt: z.iso.datetime().nullable(),
  tags: z.array(z.string()),
});

export const CreateFeedSchema = z.object({
  url: z.string().url(),
});

export const UpdateFeedSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  url: z.string().url().optional(),
  icon: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export const SyncResultSchema = z.object({
  created: z.number(),
  updated: z.number(),
});

export const DiscoveryRequestSchema = z.object({
  url: z.url(),
});

export const DiscoveredFeedSchema = z.object({
  url: z.string(),
  title: z.string(),
  type: z.string().optional(),
});

export const DiscoveryResponseSchema = z.array(DiscoveredFeedSchema);
