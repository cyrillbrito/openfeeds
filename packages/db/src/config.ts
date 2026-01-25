import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as authSchema from './schema/auth';
import * as schema from './schema/schema';

/**
 * Configuration required to initialize the db package.
 * Apps must call `initDb()` with this config before using db functions.
 */
export interface DbConfig {
  dbPath: string;
}

// Internal state - populated by initDb()
let _config: DbConfig | null = null;

/**
 * Initialize the db package with configuration.
 * Must be called once at app startup before using any db functions.
 */
export function initDb(config: DbConfig): void {
  if (_config) {
    throw new Error('Db already initialized. initDb() should only be called once.');
  }
  _config = config;
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
 * Get the auth database connection info (for drizzle config).
 */
export function authDbConnection() {
  const config = getDbConfig();
  return {
    url: `${config.dbPath}/_auth.db`,
  };
}

/**
 * Get the auth database instance.
 */
export function getAuthDb() {
  const config = getDbConfig();
  const client = new Database(`${config.dbPath}/_auth.db`);
  return drizzle({
    client,
    schema: authSchema,
  });
}

/**
 * Get the user database connection info (for drizzle config).
 */
export function userDbConnection(userId: string) {
  const config = getDbConfig();
  return {
    url: `${config.dbPath}/${userId}.db`,
  };
}

/**
 * Get the user database instance.
 */
export function getUserDb(userId: string) {
  const config = getDbConfig();
  const client = new Database(`${config.dbPath}/${userId}.db`);
  return drizzle({
    client,
    schema,
  });
}

/** Type for user database instance */
export type UserDb = ReturnType<typeof getUserDb>;

/** Type for auth database instance */
export type AuthDb = ReturnType<typeof getAuthDb>;
