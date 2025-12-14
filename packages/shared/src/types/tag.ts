import type { z } from 'zod';
import type {
  CreateTagSchema,
  TagColorSchema,
  TagSchema,
  TagWithStatsSchema,
  UpdateTagSchema,
} from '../schemas/tag';

export type TagColor = z.infer<typeof TagColorSchema>;
export type Tag = z.infer<typeof TagSchema>;
export type CreateTag = z.infer<typeof CreateTagSchema>;
export type UpdateTag = z.infer<typeof UpdateTagSchema>;
export type TagWithStats = z.infer<typeof TagWithStatsSchema>;
