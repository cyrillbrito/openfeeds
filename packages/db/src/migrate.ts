import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { db } from './config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, '../drizzle');

/**
 * Runs database migrations.
 * Safe to call on startup - only applies pending migrations.
 */
export async function runMigrations() {
  console.log('Running migrations...');
  console.log(`Migrations folder: ${migrationsFolder}`);

  // List available migration files
  const files = readdirSync(migrationsFolder).filter((f) => f.endsWith('.sql'));
  console.log(`Found ${files.length} migration file(s):`);
  for (const file of files) {
    const content = readFileSync(join(migrationsFolder, file), 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim()).length;
    console.log(`  - ${file} (${lines} statements)`);
  }

  try {
    await migrate(db, { migrationsFolder });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
}
