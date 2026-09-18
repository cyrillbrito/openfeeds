// The database connection, as a server-only module. Everything that touches
// Postgres goes through here; nothing else opens a connection.
//
// The driver is `drizzle-orm/bun-sql`, which wraps Bun's built-in `Bun.SQL`
// Postgres client — so switching engines cost no dependency at all: no `pg`,
// no `postgres.js`, no native module to compile. That is the Bun commitment
// from docs/v2-plan.md being cashed in a second time, and it is why
// `bun run start` runs the server under Bun rather than Node.
//
// Postgres rather than SQLite is settled (docs/v2-plan.md): articles and
// feeds are stored ONCE for all users, and the cron sweep writing articles
// while readers mark things read is exactly the concurrent-writer pattern
// SQLite's single writer serialises.
import 'server-only';

import type { BunSQLDatabase } from 'drizzle-orm/bun-sql';
import { resolve } from 'node:path';
import { env } from 'virtual:env/server';

import * as schema from './schema';

export * from './schema';

/**
 * Tests pass `memory://` and get PGlite: real Postgres compiled to WASM,
 * in-process, no container and nothing to clean up. It is the moral
 * equivalent of SQLite's `:memory:`, which the port would otherwise have
 * cost us — and losing it would mean `bun run test` could not run without
 * `docker compose up` first, on every machine and in CI.
 *
 * (It comes from the Electric SQL people. It is not Electric: no sync, no
 * replication, no server. The v2 rejection of Electric was of the sync
 * engine, and none of that is in this package.)
 */
const IN_MEMORY = 'memory://';

// Vite re-evaluates server modules on change in dev, and a fresh module
// evaluation would open a second pool against the same database on every
// save — leaking connections until Postgres starts refusing them. Parking
// the instance on globalThis survives module re-evaluation, so exactly one
// pool exists per process no matter how many times this module is
// re-imported. The migration promise is memoised beside it for the same
// reason: migrations must run once per process, not once per evaluation.
const DB_KEY = Symbol.for('openfeeds.db');
const MIGRATED_KEY = Symbol.for('openfeeds.db.migrated');
const globalStore = globalThis as typeof globalThis & {
  [DB_KEY]?: Db;
  [MIGRATED_KEY]?: Promise<void>;
};

/**
 * The app is typed against ONE database type, not a union of the two
 * drivers. PGlite and Bun.SQL are both `PgDatabase` over the same schema and
 * build identical queries; the driver-specific type parameter only describes
 * the shape of a raw `.execute()` result, which nothing here uses. Left as a
 * union, TypeScript intersects the two sets of overloads and starts
 * rejecting valid calls (`.returning()` was the first casualty).
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

  // A small pool, not a tuned one: a single-process server whose only
  // concurrent writer is the cron sweep. Raise it on measured contention.
  const { drizzle } = await import('drizzle-orm/bun-sql');
  return drizzle({ connection: { url: env.DATABASE_URL, max: 4 }, schema });
}

async function runMigrations(db: Db) {
  // Migrations run at boot, in-process. That is the deployment goal: the
  // app container needs a Postgres and nothing else, so there is no
  // separate migrator step to forget.
  //
  // ponytail: no advisory lock. Two app instances booting at once would
  // race here. Wrap in `SELECT pg_advisory_lock(...)` if this is ever run
  // more than single-instance.
  const folder = resolve('drizzle');
  if (env.DATABASE_URL === IN_MEMORY) {
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    await migrate(db as never, { migrationsFolder: folder });
    return;
  }
  const { migrate } = await import('drizzle-orm/bun-sql/migrator');
  await migrate(db as never, { migrationsFolder: folder });
}

// Top-level await: the Postgres migrator is async where the SQLite one was
// not, so the module itself is what waits. Every importer therefore gets a
// database that is already migrated, with no readiness check at any call
// site.
export const db = (globalStore[DB_KEY] ??= await open());
await (globalStore[MIGRATED_KEY] ??= runMigrations(db));
