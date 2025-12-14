import type { z } from 'zod';
import type { ErrorSchema } from '../schemas/common';

export type ApiError = z.infer<typeof ErrorSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}
