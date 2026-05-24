import { readdirSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import { db } from './config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(__dirname, '../drizzle');

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface Journal {
  entries: JournalEntry[];
}

/**
 * Returns the set of `created_at` timestamps (as strings) for migrations
 * already applied. Drizzle stores migrations in `drizzle.__drizzle_migrations`
 * keyed by content hash, not tag — so we match against journal entries via
 * the `when` timestamp, which drizzle writes verbatim into `created_at`.
 *
 * Returns an empty set on a fresh DB (table doesn't exist yet).
 */
async function getAppliedTimestamps(): Promise<Set<string>> {
  try {
    const rows = await db.execute<{ created_at: string }>(
      sql`select created_at from drizzle.__drizzle_migrations`,
    );
    // bun-sql returns an array-like result; rows are accessible by index.
    const list = Array.from(rows as unknown as ArrayLike<{ created_at: string }>);
    return new Set(list.map((r) => r.created_at));
  } catch {
    // Table doesn't exist yet — first run.
    return new Set();
  }
}

/**
 * Runs database migrations.
 * Safe to call on startup - only applies pending migrations.
 */
export async function runMigrations() {
  console.log('Running migrations...');
  console.log(`Migrations folder: ${migrationsFolder}`);

  // Diff the journal against what's already applied so we only log what's
  // actually going to run. Drizzle's migrate() does its own check via the
  // __drizzle_migrations table; this is purely cosmetic logging.
  let pending: JournalEntry[] = [];
  try {
    const journal: Journal = JSON.parse(
      readFileSync(join(migrationsFolder, 'meta/_journal.json'), 'utf-8'),
    );
    const applied = await getAppliedTimestamps();
    pending = journal.entries
      .filter((e) => !applied.has(String(e.when)))
      // eslint-disable-next-line unicorn/no-array-sort -- toSorted requires es2023
      .sort((a, b) => a.idx - b.idx);
  } catch (error) {
    // If anything in the diff goes sideways, fall back to listing every SQL
    // file so we at least surface what's on disk. Don't fail the boot just
    // because the logger couldn't introspect.
    console.warn('Could not determine pending migrations, listing all on disk:', error);
    const files = readdirSync(migrationsFolder)
      .filter((f) => f.endsWith('.sql'))
      // eslint-disable-next-line unicorn/no-array-sort -- toSorted requires es2023
      .sort();
    pending = files.map((f, idx) => ({ idx, tag: f.replace(/\.sql$/, ''), when: 0 }));
  }

  if (pending.length === 0) {
    console.log('No pending migrations — database is up to date.');
  } else {
    console.log(`Found ${pending.length} pending migration(s):`);
    for (const entry of pending) {
      const file = `${entry.tag}.sql`;
      const content = readFileSync(join(migrationsFolder, file), 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim()).length;
      console.log(`  - ${file} (${lines} statements)`);
    }
  }

  try {
    await migrate(db, { migrationsFolder });
    if (pending.length > 0) {
      console.log('Migrations completed successfully');
    }
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }
}
