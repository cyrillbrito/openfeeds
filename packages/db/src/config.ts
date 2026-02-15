import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { env } from './env';
import * as schema from './schema';

const client = new SQL(env.DATABASE_URL);
export const db = drizzle(client, { schema });

/** Type for database instance */
export type Db = typeof db;
