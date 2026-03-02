import { z } from 'zod';

export const FollowFeedsWithTagsSchema = z.object({
  feeds: z.array(
    z.object({
      id: z.uuidv7(),
      /** Website URL */
      url: z.url().nullable().optional(),
      /** RSS/Atom feed URL */
      feedUrl: z.url(),
      title: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      icon: z.url().nullable().optional(),
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
