import { z } from 'zod';

export const FeedTagSchema = z.object({
  id: z.string(),
  userId: z.string(),
  feedId: z.string(),
  tagId: z.string(),
});
export type FeedTag = z.infer<typeof FeedTagSchema>;

/** Schema for creating feed tags (id and userId are server-generated) */
export const CreateFeedTagSchema = FeedTagSchema.omit({
  id: true,
  userId: true,
});
export type CreateFeedTag = z.infer<typeof CreateFeedTagSchema>;
