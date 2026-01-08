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
 * This function is safe to call on startup - it will only apply pending migrations.
 */
export async function runAllMigrations(dbProvider: DbProvider) {
  console.log('🔄 Running migrations...');

  // Ensure the database directory exists before running migrations
  const authDbPath = dbProvider.authDbConnection().url;
  mkdirSync(dirname(authDbPath), { recursive: true });

  const authDb = dbProvider.authDb();

  // Migrate auth database
  console.log('📋 Migrating auth database...');
  try {
    await migrate(authDb, { migrationsFolder: authMigrationsFolder });
    console.log('✅ Auth database migrated successfully');
  } catch (error) {
    console.error('❌ Failed to migrate auth database:', error);
    throw error;
  }

  console.log('📋 Migrating user-template database...');
  try {
    const userDatabase = dbProvider.userDb('_user-template');
    await migrate(userDatabase, { migrationsFolder: userMigrationsFolder });
    console.log(`✅ User template database migrated successfully`);
  } catch (error) {
    console.error(`❌ Failed to migrate user template database:`, error);
    throw error;
  }

  // Find and migrate all user databases
  const users = await authDb.query.user.findMany({ columns: { id: true } });
  if (users.length > 0) {
    console.log(`👥 Migrating ${users.length} user databases...`);

    // Migrate each user database
    for (const user of users) {
      const userId = user.id;

      try {
        const userDatabase = dbProvider.userDb(userId);
        await migrate(userDatabase, { migrationsFolder: userMigrationsFolder });
      } catch (error) {
        console.error(`❌ Failed to migrate user database ${userId}:`, error);
        throw error;
      }
    }

    console.log(`✅ Migrated ${users.length} user databases successfully`);
  }

  console.log('🎉 All migrations completed successfully!');
}
