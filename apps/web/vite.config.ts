import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
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
  ],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  ssr: {
    // Vite externalizes node_modules by default for SSR builds, leaving bare
    // `import "drizzle-orm/..."` statements in the output. Our Dockerfile only
    // copies dist/ (no node_modules), so Node can't resolve them at runtime.
    //
    // Previously Nitro handled this (its nf3 tracer bundled + copied deps to
    // .output/server/node_modules/), but Nitro v3 is still beta and caused
    // repeated build issues (CJS/ESM interop, Rollup crashes, missing traces).
    // TanStack Start now uses native Vite builds, so we use Vite's own
    // noExternal: true to produce a fully self-contained server bundle.
    //
    // See: https://vite.dev/config/ssr-options.html#ssr-noexternal
    // See: https://github.com/TanStack/router/issues/4409
    noExternal: true,
  },
  build: {
    sourcemap: 'hidden',
  },
  server: {
    allowedHosts: true,
  },
});
