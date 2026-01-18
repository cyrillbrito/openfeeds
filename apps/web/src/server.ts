import { runAllMigrations } from '@repo/db';
import { dbProvider } from '@repo/domain';
import handler, { createServerEntry } from '@tanstack/solid-start/server-entry';

console.log('🔄 Running database migrations...');
await runAllMigrations(dbProvider);
console.log('✅ Database migrations complete');

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request);
  },
});
