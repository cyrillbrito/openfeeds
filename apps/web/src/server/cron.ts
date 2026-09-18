// The scheduler, in the app process. No Redis, no worker container, no
// queue dashboard — v1 had all three to run what is, in the end, a loop
// calling one function.
//
// `Bun.cron` is a Bun builtin, so "cron in the app process" costs a
// dependency of exactly zero. Note it takes FIVE fields (minute hour day
// month weekday); unlike some cron implementations it has no seconds field.
import 'server-only';

import {
  backfillArticleMetadata,
  countUnenrichedArticles,
} from './feeds/backfill';
import { countDueFeeds, syncDueFeeds } from './feeds/sync';

/** Sweep every 15 minutes. Feeds become due hourly; this is the granularity. */
const SCHEDULE = '*/15 * * * *';

/** Wait this long after boot before the catch-up sweep. */
const STARTUP_DELAY_MS = 5_000;

// Vite re-evaluates server modules on change, and each evaluation would
// register another cron. Two sweeps racing would fetch every due feed twice.
// The globalThis flag is what survives module re-evaluation.
const GLOBAL_KEY = Symbol.for('openfeeds.cron');
const globalStore = globalThis as typeof globalThis & {
  [GLOBAL_KEY]?: boolean;
};

async function sweep(trigger: string) {
  const due = await countDueFeeds();
  if (due === 0) return;

  const started = Date.now();
  const results = await syncDueFeeds();
  const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
  const failed = results.filter((r) => r.status === 'error').length;

  console.log(
    `[cron:${trigger}] ${results.length} feeds in ${Date.now() - started}ms — ` +
      `${inserted} new article(s)${failed > 0 ? `, ${failed} failed` : ''}`,
  );
}

/**
 * Enrich articles that predate the media columns.
 *
 * Here rather than in db/index.ts because that module opens the connection
 * synchronously and this is async work — and because this belongs with the
 * other thing that runs after boot and must never take the server down.
 */
async function enrich() {
  const outstanding = await countUnenrichedArticles();
  if (outstanding === 0) return;

  const started = Date.now();
  const done = await backfillArticleMetadata();
  console.log(
    `[backfill] enriched ${done} article(s) in ${Date.now() - started}ms`,
  );
}

/** Never let a sweep failure take the server down with it. */
function safeSweep(trigger: string) {
  sweep(trigger).catch((error) => {
    console.error(`[cron:${trigger}] sweep failed:`, error);
  });
}

/**
 * Start the sweep. Idempotent: calling it twice in one process is a no-op,
 * which is what makes it safe to import from a module Vite may re-evaluate.
 */
export function startFeedCron() {
  if (globalStore[GLOBAL_KEY]) return;
  globalStore[GLOBAL_KEY] = true;

  // Before the first sweep, so a reader with existing history sees excerpts
  // and thumbnails on its next page load rather than only on new articles.
  enrich().catch((error) => console.error('[backfill] failed:', error));

  // A restart should not make overdue feeds wait for the next quarter hour.
  // The delay just keeps the sweep off the critical path of the first request.
  setTimeout(() => safeSweep('startup'), STARTUP_DELAY_MS).unref?.();

  if (typeof Bun !== 'undefined' && typeof Bun.cron === 'function') {
    Bun.cron(SCHEDULE, () => safeSweep('schedule'));
    console.log(`[cron] feed sweep scheduled (${SCHEDULE}) via Bun.cron`);
    return;
  }

  // Bun is the target runtime, but the app still runs under Node (see
  // CLAUDE.md), and a feed reader that silently stops fetching is worse than
  // one with a cruder timer.
  const FIFTEEN_MINUTES = 15 * 60 * 1000;
  setInterval(() => safeSweep('interval'), FIFTEEN_MINUTES).unref?.();
  console.log('[cron] feed sweep scheduled via setInterval (Bun.cron absent)');
}
