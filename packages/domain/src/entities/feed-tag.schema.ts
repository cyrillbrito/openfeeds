import { z } from 'zod';

export const FeedTagSchema = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  feedId: z.uuidv7(),
  tagId: z.uuidv7(),
});
export type FeedTag = z.infer<typeof FeedTagSchema>;

/** Schema for creating feed tags (userId is server-generated, id is optional) */
export const CreateFeedTagSchema = FeedTagSchema.omit({
  userId: true,
}).extend({
  id: z.uuidv7().optional(),
});
export type CreateFeedTag = z.infer<typeof CreateFeedTagSchema>;
