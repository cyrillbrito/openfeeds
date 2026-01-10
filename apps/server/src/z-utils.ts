import { z } from 'zod';

export const idSchema = z.string().min(1).describe('Unique identifier');

/** For request params schema */
export const idParamObjSchema = z.object({
  id: z.string().describe('Identifier'),
});
