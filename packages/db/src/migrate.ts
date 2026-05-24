import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { db } from './config';

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '../drizzle');

/** Applies pending migrations. Safe to call on startup — drizzle skips applied ones. */
export async function runMigrations() {
  await migrate(db, { migrationsFolder });
}
