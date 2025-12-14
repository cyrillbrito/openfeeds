import path from 'path';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { DbProvider } from './db-provider';

/**
 * Will be executed in the context of the API,
 * so the path needs to be relative to that.
 */
export async function createUserDb(dbProvider: DbProvider, userId: string) {
  const db = dbProvider.userDb(userId);
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../drizzle'),
  });
}
