import { z } from 'zod';

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

export const CursorQuerySchema = z.object({
  cursor: z.string().optional().describe('TODO'),
  limit: z.coerce
    .number()
    .max(10000)
    .default(20)
    .optional()
    .describe('Number of items to return. Defaults to 20.'),
});
