// The feed sweep, scheduled in the app process. `Bun.cron` takes five
// fields (minute hour day month weekday) — no seconds field.
import 'server-only';

import { syncDueFeeds } from './feeds/sync';

/** Feeds become due hourly; this is the granularity of noticing. */
const SCHEDULE = '*/15 * * * *';
const INTERVAL_MS = 15 * 60 * 1000;
/** Keeps the catch-up sweep off the first request's critical path. */
const STARTUP_DELAY_MS = 5_000;

// Vite re-evaluates server modules on change; without this each evaluation
// registers another cron and two sweeps race over the same due feeds.
const GLOBAL_KEY = Symbol.for('openfeeds.cron');
const globalStore = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: boolean;
};

async function sweep(trigger: string) {
  const started = Date.now();
  const results = await syncDueFeeds();
  if (results.length === 0) return;

  const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const failed = results.filter((r) => r.status === 'error').length;
  console.log(
    `[cron:${trigger}] ${results.length} feeds in ${Date.now() - started}ms — ` +
      `${inserted} new article(s)${failed > 0 ? `, ${failed} failed` : ''}`,
  );
}

/** A sweep failure must never take the server down. */
function safeSweep(trigger: string) {
  sweep(trigger).catch((error) => {
    console.error(`[cron:${trigger}] sweep failed:`, error);
  });
}

/** Idempotent: safe to call from a module Vite may re-evaluate. */
export function startFeedCron() {
  if (globalStore[GLOBAL_KEY]) return;
  globalStore[GLOBAL_KEY] = true;

  // A restart should not make overdue feeds wait for the next quarter hour.
  setTimeout(() => safeSweep('startup'), STARTUP_DELAY_MS).unref?.();

  if (typeof Bun !== 'undefined' && typeof Bun.cron === 'function') {
    Bun.cron(SCHEDULE, () => safeSweep('schedule'));
    console.log(`[cron] feed sweep scheduled (${SCHEDULE}) via Bun.cron`);
    return;
  }

  // Bun is the target, but the app still runs under Node, where Bun.cron is
  // absent. A reader that silently stops fetching is worse than a crude timer.
  setInterval(() => safeSweep('interval'), INTERVAL_MS).unref?.();
  console.log('[cron] feed sweep scheduled via setInterval (Bun.cron absent)');
}
