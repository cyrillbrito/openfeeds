import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { env } from './env';
import * as schema from './schema';

const RETRYABLE_CODES = new Set(['ERR_POSTGRES_CONNECTION_CLOSED']);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

function withRetry(client: SQL): SQL {
  const originalUnsafe = client.unsafe.bind(client);
  // @ts-expect-error - wrapping native method with retry logic
  client.unsafe = async function retryableUnsafe(query: string, params?: unknown[]) {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await originalUnsafe(query, params);
      } catch (error: unknown) {
        lastError = error;
        const code = (error as { code?: string })?.code;
        if (!RETRYABLE_CODES.has(code ?? '')) throw error;
        if (attempt < MAX_RETRIES - 1) {
          await Bun.sleep(RETRY_DELAY_MS * 2 ** attempt);
        }
      }
    }
    throw lastError;
  };
  return client;
}

const client = withRetry(new SQL(env.DATABASE_URL));
export const db = drizzle(client, { schema });

/** Type for database instance */
export type Db = typeof db;

/** Type for transaction object received in `db.transaction(async (tx) => ...)` */
export type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];
