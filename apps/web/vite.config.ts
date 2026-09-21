import { fileURLToPath } from 'node:url';
import { fileRoutes } from 'filesystem-routing/vite';
import { defineConfig } from 'vitest/config';
import solid from '@solidjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // No index.html and no entry files: the plugin generates the entries
  // around src/App.tsx, wrapped in src/Document.tsx. `vite build` emits
  // dist/client and dist/server; server.js serves both.
  plugins: [
    solid({
      start: {
        middleware: './src/middleware.ts',
        // Typed env is on by convention — ./env.ts is probed and validated.
      },
      ssr: true,
      // Compiles 'use server' into fetch calls served from /_server. The
      // configure module registers the router's single-flight collector.
      serverFunctions: { configure: './src/server-config.ts' },
      // Also compile the `?pick=` route modules fileRoutes emits — their
      // ids end in a query string.
      extensions: ['.jsx', '.tsx'],
    }),
    // Tailwind 4 as a Vite plugin: no config file, no content globs. The
    // theme is declared in src/app.css.
    tailwindcss(),
    // `httpMethods` also scans route modules for GET/POST/... exports, so
    // handler modules and their server-only imports stay out of the client
    // bundle.
    fileRoutes({ httpMethods: true, types: true }),
  ],
  server: {
    port: 3000,
  },
  test: {
    globals: false,
    setupFiles: ['./vitest-setup.ts'],
    // Two projects: component tests in a DOM against the browser build,
    // server tests in node against the real server build.
    projects: [
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          // .tsx anywhere, plus .ts outside src/server — without the second
          // pattern a plain .ts test in src/lib matches NO project and is
          // silently never run.
          include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
          exclude: ['src/server/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          // environment:'node' gets the server posture from the plugin
          // automatically: server conditions and ssr codegen.
          environment: 'node',
          include: ['src/server/**/*.test.ts'],
          alias: [
            // Tests run outside the turnkey server: the plugin's env module
            // is stubbed with the same contract (live process.env reads).
            {
              find: 'virtual:env/server',
              replacement: fileURLToPath(
                new URL('./vitest-env-server-stub.ts', import.meta.url),
              ),
            },
          ],
        },
      },
    ],
  },
  // `bun` is a builtin with no file to resolve, so Vite must leave it
  // alone. PGlite is a test-only devDependency behind a dynamic import, so
  // a production install without dev dependencies must not try to bundle it.
  ssr: {
    external: ['bun', '@electric-sql/pglite'],
  },
  optimizeDeps: {
    exclude: ['bun', '@electric-sql/pglite'],
  },
  build: {
    target: 'esnext',
    // Keep images as asset files instead of inlining them into the JS bundle.
    assetsInlineLimit: 0,
  },
});
