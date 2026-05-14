import { urlSchema } from '@repo/safe-fetch/schema';
import { z } from 'zod';

/**
 * Feed URL schema — currently equivalent to {@link urlSchema} (http/https
 * only). Re-exported as a domain-level alias so we can later layer feed-
 * specific rules (length limits, blocklist hosts, normalisation, ...)
 * without touching every call-site.
 */
export const feedUrlSchema = urlSchema;

export const SyncStatusSchema = z.enum(['ok', 'failing', 'broken']);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const FeedSchema = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  url: z.string(),
  feedUrl: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  lastSyncAt: z.iso.datetime().nullable(),
  syncStatus: SyncStatusSchema.default('ok'),
  syncError: z.string().nullable().default(null),
});
export type Feed = z.infer<typeof FeedSchema>;

export const CreateFeedSchema = z.object({
  id: z.uuidv7().optional(),
  /** Website URL — if omitted, defaults to feedUrl until the feed-detail worker enriches it */
  url: z.url().nullable().optional(),
  /** RSS/Atom feed URL (required) */
  feedUrl: feedUrlSchema,
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  icon: z.url().nullable().optional(),
});
export type CreateFeed = z.infer<typeof CreateFeedSchema>;

export const UpdateFeedSchema = z.object({
  id: z.uuidv7(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  url: z.url().optional(),
  icon: z.string().nullable().optional(),
});
export type UpdateFeed = z.infer<typeof UpdateFeedSchema>;
