import { initDb, runMigrations } from '@repo/db';
import { env } from './environment';

try {
  initDb({ databaseUrl: env.DATABASE_URL });
  await runMigrations();
  process.exit(0);
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
