import { initDb, runAllMigrations } from '@repo/db';
import { env } from './environment';

try {
  initDb({ dbPath: env.DB_PATH });
  await runAllMigrations();
  process.exit(0);
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
