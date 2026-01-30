import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import * as schema from './schema';

/**
 * Configuration required to initialize the db package.
 * Apps must call `initDb()` with this config before using db functions.
 */
export interface DbConfig {
  databaseUrl: string;
}

// Internal state - populated by initDb()
let _config: DbConfig | null = null;
let _db: ReturnType<typeof createDbInstance> | null = null;

function createDbInstance(connectionString: string) {
  const client = new SQL(connectionString);
  return drizzle(client, { schema });
}

/**
 * Initialize the db package with configuration.
 * Must be called once at app startup before using any db functions.
 */
export function initDb(config: DbConfig): void {
  if (_config) return;
  _config = config;
  _db = createDbInstance(config.databaseUrl);
}

/**
 * Get the db configuration. Throws if not initialized.
 */
export function getDbConfig(): DbConfig {
  if (!_config) {
    throw new Error('Db not initialized. Call initDb() first.');
  }
  return _config;
}

/**
 * Get the database instance.
 * Single database handles both auth and user data (user isolation via userId FK).
 */
export function getDb() {
  if (!_db) {
    throw new Error('Db not initialized. Call initDb() first.');
  }
  return _db;
}

/** Type for database instance */
export type Db = ReturnType<typeof getDb>;
