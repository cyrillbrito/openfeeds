import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { env } from './env';
import * as schema from './schema';

// Close idle connections after 60s so we proactively drop them before the
// server or any proxy (PgBouncer, Supavisor, etc.) kills them, which would
// otherwise cause ERR_POSTGRES_CONNECTION_CLOSED on in-flight queries.
// Kept comfortably above the longest in-job HTTP timeout (~30s) so the pool
// never reaps a connection mid-job between two await ctx.conn.* calls.
const client = new SQL(env.DATABASE_URL, { idleTimeout: 60, maxLifetime: 3600 });
export const db = drizzle(client, { schema });

/** Type for database instance */
export type Db = typeof db;

/** Type for transaction object received in `db.transaction(async (tx) => ...)` */
export type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
