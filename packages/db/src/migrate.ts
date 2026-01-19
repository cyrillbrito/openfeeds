import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { DbProvider } from './db-provider';

const __dirname = dirname(fileURLToPath(import.meta.url));
const authMigrationsFolder = join(__dirname, '../drizzle-auth');
const userMigrationsFolder = join(__dirname, '../drizzle');

/**
 * Runs all database migrations for auth, user-template, and all user databases.
 * Safe to call on startup - only applies pending migrations.
 */
export async function runAllMigrations(dbProvider: DbProvider) {
  console.log('Running migrations...');

  // Ensure the database directory exists before running migrations
  const authDbPath = dbProvider.authDbConnection().url;
  mkdirSync(dirname(authDbPath), { recursive: true });

  const authDb = dbProvider.authDb();

  console.log('Migrating auth database...');
  try {
    migrate(authDb, { migrationsFolder: authMigrationsFolder });
  } catch (error) {
    console.error('Failed to migrate auth database:', error);
    throw error;
  }

  console.log('Migrating user-template database...');
  try {
    migrate(dbProvider.userDb('_user-template'), { migrationsFolder: userMigrationsFolder });
  } catch (error) {
    console.error('Failed to migrate user-template database:', error);
    throw error;
  }

  const users = await authDb.query.user.findMany({ columns: { id: true } });
  if (users.length > 0) {
    console.log(`Migrating ${users.length} user databases...`);
    for (const user of users) {
      try {
        migrate(dbProvider.userDb(user.id), { migrationsFolder: userMigrationsFolder });
      } catch (error) {
        console.error(`Failed to migrate user database ${user.id}:`, error);
        throw error;
      }
    }
  }

  console.log('All migrations completed');
}
