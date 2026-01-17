import { runAllMigrations } from '@repo/db';
import { dbProvider } from '@repo/domain';
import { definePlugin } from 'nitro';

export default definePlugin(async () => {
  await runAllMigrations(dbProvider);
});
