import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { DbProvider } from './db-provider';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createUserDb(dbProvider: DbProvider, userId: string) {
  const db = dbProvider.userDb(userId);
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../drizzle'),
  });
}
