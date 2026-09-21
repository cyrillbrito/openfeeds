/**
 * A guard on the test runner's RUNTIME, not on app behaviour.
 *
 * The `vitest` binary carries a `#!/usr/bin/env node` shebang, so without
 * `--bun` the suite runs under Node — where `Bun.SQL` does not resolve and
 * every DB-backed test fails at import looking like a bundler problem. This
 * fails loudly if that flag is ever dropped from package.json.
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
