import { z } from 'zod';

export const FollowFeedsWithTagsSchema = z.object({
  feeds: z.array(
    z.object({
      id: z.uuidv7(),
      url: z.url(),
    }),
  ),
  newTags: z.array(
    z.object({
      id: z.uuidv7(),
      name: z.string(),
    }),
  ),
  feedTags: z.array(
    z.object({
      id: z.uuidv7(),
      feedId: z.uuidv7(),
      tagId: z.uuidv7(),
    }),
  ),
});

export type FollowFeedsWithTags = z.infer<typeof FollowFeedsWithTagsSchema>;
