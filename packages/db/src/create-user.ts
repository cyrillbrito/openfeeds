import path from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { getUserDb } from './config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createUserDb(userId: string) {
  const db = getUserDb(userId);
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../drizzle'),
  });
}
