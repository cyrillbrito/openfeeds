/**
 * Manual migration entry point.
 *
 * Used for out-of-band operations: applying migrations without redeploying the
 * server (e.g. `CREATE INDEX CONCURRENTLY`), local development (`bun migrate`),
 * and CI test setup. The server also calls `runMigrations()` on boot — see
 * `apps/server/src/index.ts` — so a normal deploy doesn't need this script.
 */
import { runMigrations } from './migrate';

try {
  await runMigrations();
  process.exit(0);
} catch {
  process.exit(1);
}
