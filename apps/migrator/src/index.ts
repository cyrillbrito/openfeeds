import { DbProvider, runAllMigrations } from '@repo/db';
import { environment } from './environment';

try {
  const dbProvider = new DbProvider({ dbPath: environment.dbPath });
  await runAllMigrations(dbProvider);
  process.exit(0);
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
}
