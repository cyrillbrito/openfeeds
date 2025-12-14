import type { z } from 'zod';
import type { ImportOpmlRequestSchema, ImportResultSchema } from '../schemas/import';

export type ImportResult = z.infer<typeof ImportResultSchema>;
export type ImportOpmlRequest = z.infer<typeof ImportOpmlRequestSchema>;
