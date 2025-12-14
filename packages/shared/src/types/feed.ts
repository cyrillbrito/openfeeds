import type { z } from 'zod';
import type {
  CreateFeedSchema,
  DiscoveredFeedSchema,
  DiscoveryRequestSchema,
  DiscoveryResponseSchema,
  FeedSchema,
  SyncResultSchema,
  UpdateFeedSchema,
} from '../schemas/feed';

export type Feed = z.infer<typeof FeedSchema>;
export type CreateFeed = z.infer<typeof CreateFeedSchema>;
export type UpdateFeed = z.infer<typeof UpdateFeedSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
export type DiscoveryRequest = z.infer<typeof DiscoveryRequestSchema>;
export type DiscoveredFeed = z.infer<typeof DiscoveredFeedSchema>;
export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>;
