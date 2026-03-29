import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import lucidePreprocess from 'vite-plugin-lucide-preprocess';
import solidPlugin from 'vite-plugin-solid';
import viteTsConfigPaths from 'vite-tsconfig-paths';

const rootPkg = JSON.parse(readFileSync('../../package.json', 'utf-8'));

export default defineConfig({
  plugins: [
    lucidePreprocess(),
    devtools(),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss() as any,
    tanstackStart({
      importProtection: {
        client: {
          // Block server-only monorepo packages from the client bundle.
          // Use `@repo/domain/client` for schemas/types, and dynamic
          // `await import()` inside .server() callbacks for full CRUD.
          // See: https://github.com/TanStack/router/issues/2783
          //
          specifiers: ['@repo/db', '@repo/domain'],
        },
      },
    }),
    solidPlugin({ ssr: true }),
    // Nitro provides the production HTTP server, static file serving, and
    // self-contained .output/ directory with bundled dependencies.
    // Required for Node.js/Docker deployment per TanStack Start hosting docs.
    // See: https://tanstack.com/start/latest/docs/framework/solid/guide/hosting
    nitro(),
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
});
