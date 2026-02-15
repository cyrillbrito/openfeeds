import { runMigrations } from '@repo/db';

try {
  await runMigrations();
  process.exit(0);
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
