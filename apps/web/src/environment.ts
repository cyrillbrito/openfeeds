import { z } from 'zod';

export const environment = z
  .object({
    VITE_API_URL: z.string().optional(),
  })
  .transform((val) => ({
    apiUrl: val.VITE_API_URL,
  }))
  .parse(import.meta.env);
