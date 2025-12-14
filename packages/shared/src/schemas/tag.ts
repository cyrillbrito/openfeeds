import { z } from 'zod';

const chromaticColors = [
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
] as const;

export const TagColorSchema = z.enum(chromaticColors).nullable();

export const TagSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: TagColorSchema,
  createdAt: z.iso.datetime(),
});

export const CreateTagSchema = z.object({
  name: z.string(),
  color: TagColorSchema.optional(),
});

export const UpdateTagSchema = z.object({
  name: z.string().optional(),
  color: TagColorSchema.optional(),
});

export const TagWithStatsSchema = TagSchema.extend({
  feedCount: z.number().optional(),
  articleCount: z.number().optional(),
});
