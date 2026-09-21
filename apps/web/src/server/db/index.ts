// The one Postgres connection. The driver is `drizzle-orm/bun-sql`, wrapping
// Bun's built-in `Bun.SQL` — no `pg`, no `postgres.js`, no native module,
// which is why the server runs under Bun rather than Node.
import 'server-only';

import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { resolve } from 'node:path';
import { env } from 'virtual:env/server';

import * as schema from './schema';

export * from './schema';

/**
 * Tests pass `memory://` and get PGlite: Postgres compiled to WASM, in
 * process, so `bun run test` needs no container.
 */
const IN_MEMORY = 'memory://';

// Vite re-evaluates server modules on change, and each evaluation would open
// another pool and re-run migrations. globalThis survives re-evaluation, so
// there is exactly one of each per process.
const DB_KEY = Symbol.for('openfeeds.db');
const MIGRATED_KEY = Symbol.for('openfeeds.db.migrated');
const globalStore = globalThis as typeof globalThis & {
  [DB_KEY]?: Db;
  [MIGRATED_KEY]?: Promise<void>;
};

/**
 * ONE database type, not a union of the two drivers: they build identical
 * queries and differ only in the shape of a raw `.execute()` result, which
 * nothing uses — but a union intersects their overloads and rejects valid
 * calls (`.returning()` first).
 */
type Db = BunSQLDatabase<typeof schema>;

async function open(): Promise<Db> {
  if (env.DATABASE_URL === IN_MEMORY) {
    const { drizzle } = await import('drizzle-orm/pglite');
    return drizzle({
      connection: { dataDir: IN_MEMORY },
      schema,
    }) as unknown as Db;
  }

  // Small, not tuned: one process whose only concurrent writer is the sweep.
  const { drizzle } = await import('drizzle-orm/bun-sql');
  return drizzle({ connection: { url: env.DATABASE_URL, max: 4 }, schema });
}

// Migrations run at boot, in process: the app container needs a Postgres and
// nothing else, with no separate migrator step to forget.
//
// ponytail: no advisory lock. Two instances booting together would race here;
// wrap in `SELECT pg_advisory_lock(...)` if this ever runs multi-instance.
async function runMigrations(db: Db) {
  const folder = resolve('drizzle');
  if (env.DATABASE_URL === IN_MEMORY) {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as never, { migrationsFolder: folder });
    return;
  }
  const { migrate } = await import('drizzle-orm/bun-sql/migrator');
  await migrate(db as never, { migrationsFolder: folder });
}

// Top-level await, so every importer gets an already-migrated database and
// no call site needs a readiness check.
export const db = (globalStore[DB_KEY] ??= await open());
await (globalStore[MIGRATED_KEY] ??= runMigrations(db));
