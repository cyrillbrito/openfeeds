import { z } from 'zod';

export const environment = z
  .object({
    DB_PATH: z.string().default('./dbs'),
  })
  .transform((env) => ({
    dbPath: env.DB_PATH,
  }))
  .parse(process.env);
