import { z } from 'zod';

// OPML import schemas
export const ImportResultSchema = z.object({
  imported: z.number(),
  failed: z.array(z.string()),
});

export const ImportOpmlRequestSchema = z.object({
  opmlContent: z.string(),
});
