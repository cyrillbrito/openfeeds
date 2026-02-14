import { z } from 'zod';

export const FeedTagSchema = z.object({
  id: z.string(),
  userId: z.string(),
  feedId: z.string(),
  tagId: z.string(),
});
export type FeedTag = z.infer<typeof FeedTagSchema>;

/** Schema for creating feed tags (userId is server-generated, id is optional) */
export const CreateFeedTagSchema = FeedTagSchema.omit({
  userId: true,
}).extend({
  id: z.string().optional(),
});
export type CreateFeedTag = z.infer<typeof CreateFeedTagSchema>;
