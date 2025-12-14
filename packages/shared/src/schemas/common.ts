import { z } from 'zod';

// Generic paginated response schema
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: z.array(dataSchema),
    nextCursor: z.string().nullable(),
    total: z.number(),
  });
}

// Common error schema
export const ErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  code: z.string().optional(),
});

export const CursorQuerySchema = z.object({
  cursor: z.string().optional().describe('TODO'),
  limit: z.coerce
    .number()
    .max(10000)
    .default(20)
    .optional()
    .describe('Number of items to return. Defaults to 20.'),
});
