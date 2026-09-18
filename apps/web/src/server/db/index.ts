// The database connection, as a server-only module. Everything that touches
// SQLite goes through here; nothing else opens a connection.
//
// `bun:sqlite` is Bun's built-in driver — no native module to compile, no
// dependency to install. That is the Bun commitment from docs/v2-plan.md
// being cashed in, and it is why `bun run start` runs the server under Bun
// rather than Node.
//
// Drizzle sits on top, so the driver is swappable: pointing this file at
// `drizzle-orm/libsql` would let a deployment use Turso for managed backups
// without a single change anywhere else in the app.
import 'server-only';

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { env } from 'virtual:env/server';

import * as schema from './schema';

export * from './schema';

// Vite re-evaluates server modules on change in dev, and a fresh module
// evaluation would open a second connection to the same file on every save —
// leaking handles until SQLite starts refusing them. Parking the instance on
// globalThis survives module re-evaluation, so exactly one connection exists
// per process no matter how many times this module is re-imported.
const GLOBAL_KEY = Symbol.for('openfeeds.db');
const globalStore = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: ReturnType<typeof open>;
};

function open() {
  // ':memory:' is SQLite's magic name for a transient database, not a file
  // path — resolving it would produce a directory called ":memory:" in the
  // project root. Tests use it to get a real database with no cleanup.
  const inMemory = env.DATABASE_PATH === ':memory:';
  const path = inMemory ? ':memory:' : resolve(env.DATABASE_PATH);
  if (!inMemory) mkdirSync(dirname(path), { recursive: true });

  const sqlite = new Database(path, { create: true, strict: true });
  // WAL lets reads proceed during a write, which matters because the cron
  // sweep writes articles while the UI is reading them. `foreign_keys` is
  // OFF by default in SQLite — without it the `onDelete: 'cascade'` in the
  // schema is decorative and deleting a feed would orphan its articles.
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');
  // Wait rather than throwing SQLITE_BUSY when the sweep holds the writer.
  sqlite.exec('PRAGMA busy_timeout = 5000');

  const db = drizzle(sqlite, { schema });

  // Migrations run at boot, in-process. That is the "one container, one
  // file" goal: `docker run -v ./data:/data openfeeds` has to be enough, so
  // there is no separate migrator step to forget.
  migrate(db, { migrationsFolder: resolve('drizzle') });

  return db;
}

export const db = (globalStore[GLOBAL_KEY] ??= open());
