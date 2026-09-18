/**
 * A guard on the test runner's RUNTIME, not on app behaviour.
 *
 * The `vitest` binary carries a `#!/usr/bin/env node` shebang, so a plain
 * `vitest` script runs the suite under Node even when Bun invoked it. That
 * matters here because the database driver is `Bun.SQL`, a Bun builtin with
 * no Node equivalent — under Node every DB-backed test fails at import with
 * a message about an unresolvable module, which looks like a bundler
 * problem and is not one. `Bun.cron` has the same shape of problem and
 * fails more quietly: it silently degrades to setInterval.
 *
 * The fix is the `--bun` flag in package.json's test script. This test fails
 * loudly if that flag is ever dropped.
 */
import { expect, it } from 'vitest';

it('runs under Bun, so the Bun.SQL driver is importable', async () => {
  expect(
    typeof (globalThis as { Bun?: unknown }).Bun,
    'tests must run via `bun --bun vitest` — see package.json',
  ).toBe('object');

  const { SQL } = await import('bun');
  expect(typeof SQL).toBe('function');
});
