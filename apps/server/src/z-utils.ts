import { z } from 'zod';

export const idSchema = z.number().gte(1).describe('Unique identifier');

/** For request params schema */
export const idParamObjSchema = z.object({
  id: z.coerce.number().describe('Identifier'),
});
