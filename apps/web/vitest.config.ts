import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig } from 'vitest/config';
import storybookViteConfig from './vite.config.storybook';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Vitest config for running Storybook stories as tests in CI.
// Uses the minimal storybook Vite config (no Nitro/TanStack Start) to avoid
// spawning background server processes that prevent clean exit.
export default mergeConfig(
  storybookViteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          plugins: [
            storybookTest({
              configDir: path.join(dirname, '.storybook'),
            }),
          ],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              provider: playwright({}),
              instances: [{ browser: 'chromium' }],
            },
            // CJS-only packages (debug, extend) pulled in by the markdown
            // pipeline need explicit pre-bundling in Vitest browser mode.
            // Vite's optimizeDeps.include covers dev server but not Vitest.
            deps: {
              optimizer: {
                web: {
                  include: ['debug', 'extend'],
                },
              },
            },
          },
        },
      ],
    },
  }),
);
