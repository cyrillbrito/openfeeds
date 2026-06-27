import { defineConfig, devices } from '@playwright/test';

/**
 * Base URL for the app under test.
 * Reads from BASE_URL env var so tests work against any host
 * (localhost, Tailscale, staging, etc). Defaults to localhost.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3400';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Workers: let Playwright pick locally; cap at 3 on CI (ubuntu-latest has 4 vCPUs). */
  workers: process.env.CI ? 3 : undefined,

  /* Reporter config: HTML report for interactive browsing, JSON for CI summary comment */
  reporter: process.env.CI
    ? [
        ['html', { open: 'never' }],
        ['json', { outputFile: 'results.json' }],
      ]
    : [['html', { open: 'on-failure' }]],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: BASE_URL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* CI is the source of truth for visual snapshots (linux baselines).
   * Locally, use a loose threshold so darwin font rendering doesn't cause failures. */
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: process.env.CI ? 0 : 0.2 },
  },

  timeout: 5000,

  snapshotPathTemplate: './screenshots/{testFilePath}/{arg}-{projectName}-{platform}{ext}',

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Servers Playwright manages for the test run.
   *
   * - mock-server: stand-in RSS endpoints on :9999.
   * - server + SPA on :3400: in local dev, Playwright starts it from a fresh
   *   build so `bunx playwright test` works without a prior `bun dev`. In
   *   CI, the workflow starts the process itself (see ci.yml) — set
   *   `reuseExistingServer: true` so Playwright just waits for the existing
   *   listener instead of trying to spawn a duplicate.
   *
   * Two-process dev (server on :3401 + vite on :3400 with HMR) is the daily
   * driver; for E2E we use the production-shaped single-process build so
   * the test bundle matches what ships. */
  webServer: [
    {
      command: 'bun mock-server/start-server.ts',
      url: 'http://localhost:9999',
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
    {
      // From apps/e2e: run the root build (which builds and links the SPA +
      // marketing site into apps/server), then run the server.
      // Mirrors the CI step (.github/workflows/ci.yml).
      command: ['bun --cwd ../.. run build', 'bun --cwd ../.. run start'].join(' && '),
      url: 'http://localhost:3400',
      // CI starts the server out-of-band; reuse it instead of spawning a duplicate.
      reuseExistingServer: true,
      timeout: 120_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
