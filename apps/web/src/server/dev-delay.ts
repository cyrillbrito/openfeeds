// A development-only stall in front of the data layer.
//
// Loading states are the hardest thing to test on localhost: SQLite answers
// in under a millisecond, so <Loading> boundaries and pending-submission
// spinners flash past before anyone can look at them. Setting
// SYNTHETIC_DELAY_MS makes every server function in src/lib/feeds.ts wait
// that long, which is enough to see them.
//
// It is fused shut in production two ways: `import.meta.env.DEV` is a build
// constant, so the whole body folds to a no-op in the production bundle, and
// the variable defaults to 0 anyway.
import 'server-only';

import { env } from 'virtual:env/server';

const DELAY_MS = Number(env.SYNTHETIC_DELAY_MS ?? 0);

/**
 * Await this at the top of a server function to make it artificially slow.
 * Returns an already-settled promise unless the knob is set in dev.
 */
export async function slowDown(): Promise<void> {
  if (!import.meta.env.DEV) return;
  if (!Number.isFinite(DELAY_MS) || DELAY_MS <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
}
