import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
import { playwright } from '@vitest/browser-playwright';
import { nitro } from 'nitro/vite';
import lucidePreprocess from 'vite-plugin-lucide-preprocess';
import solidPlugin from 'vite-plugin-solid';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));
const rootPkg = JSON.parse(readFileSync('../../package.json', 'utf-8'));

// Bundling strategy: docs/decisions/2026-03-29-nitro-cjs-esm-bundling.md
export default defineConfig({
  plugins: [
    lucidePreprocess(),
    devtools(),
    nitro({
      commonJS: {
        // ESM packages consumed via require() (svix → uuid, msgpackr).
        // Tells @rollup/plugin-commonjs to use namespace imports instead of default.
        esmExternals: ['uuid', 'msgpackr'],
        requireReturnsDefault: 'namespace',
      },
      // Packages that break when bundled (read sibling files at runtime).
      // Nitro hardcodes noExternal:true — only rollupConfig.external works.
      rollupConfig: {
        external: ['jsdom', 'css-tree', '@mixmark-io/domino'],
      },
    }),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart({
      importProtection: {
        client: {
          // Block server-only monorepo packages from the client bundle.
          // Use `@repo/domain/client` for schemas/types, and dynamic
          // `await import()` inside .server() callbacks for full CRUD.
          // See: https://github.com/TanStack/router/issues/2783
          //
          specifiers: ['@repo/db', '@repo/domain', 'bun'],
        },
      },
    }),
    solidPlugin({
      ssr: true,
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  build: {
    sourcemap: 'hidden',
  },
  server: {
    allowedHosts: true,
  },
  // Vitest project for running Storybook stories as tests in CI.
  // Each story is rendered headlessly in Chromium via Playwright.
  // More info: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
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
        },
      },
    ],
  },
});
