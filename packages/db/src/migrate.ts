import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { authDbConnection, getAuthDb, getUserDb } from './config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const authMigrationsFolder = join(__dirname, '../drizzle-auth');
const userMigrationsFolder = join(__dirname, '../drizzle');

/**
 * Runs all database migrations for auth, user-template, and all user databases.
 * Safe to call on startup - only applies pending migrations.
 * Requires initDb() to be called first.
 */
export async function runAllMigrations() {
  console.log('Running migrations...');

  // Ensure the database directory exists before running migrations
  const authDbPath = authDbConnection().url;
  mkdirSync(dirname(authDbPath), { recursive: true });

  const authDb = getAuthDb();

  console.log('Migrating auth database...');
  try {
    migrate(authDb, { migrationsFolder: authMigrationsFolder });
  } catch (error) {
    console.error('Failed to migrate auth database:', error);
    throw error;
  }

  console.log('Migrating user-template database...');
  try {
    migrate(getUserDb('_user-template'), { migrationsFolder: userMigrationsFolder });
  } catch (error) {
    console.error('Failed to migrate user-template database:', error);
    throw error;
  }

  const users = await authDb.query.user.findMany({ columns: { id: true } });
  if (users.length > 0) {
    console.log(`Migrating ${users.length} user databases...`);
    for (const user of users) {
      try {
        migrate(getUserDb(user.id), { migrationsFolder: userMigrationsFolder });
      } catch (error) {
        console.error(`Failed to migrate user database ${user.id}:`, error);
        throw error;
      }
    }
  }

  console.log('All migrations completed');
}
