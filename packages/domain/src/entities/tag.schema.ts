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

const TagColorSchema = z.enum(chromaticColors).nullable();
export type TagColor = z.infer<typeof TagColorSchema>;

export const TagSchema = z.object({
  id: z.uuidv7(),
  userId: z.string(),
  name: z.string(),
  color: TagColorSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Tag = z.infer<typeof TagSchema>;

export const CreateTagSchema = z.object({
  id: z.uuidv7().optional(),
  name: z.string(),
  color: TagColorSchema.optional(),
});
export type CreateTag = z.infer<typeof CreateTagSchema>;

export const UpdateTagSchema = z.object({
  id: z.uuidv7(),
  name: z.string().optional(),
  color: TagColorSchema.optional(),
});
export type UpdateTag = z.infer<typeof UpdateTagSchema>;
