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

/**
 * Packages that nf3 (Nitro's dependency tracer) externalizes and copies to
 * `.output/server/node_modules/`. These are ESM packages required by CJS code
 * (svix → uuid, msgpackr). Without esmExternals + requireReturnsDefault,
 * @rollup/plugin-commonjs generates `import x from "uuid"` (default import)
 * which fails because uuid only has named exports.
 *
 * `esmExternals` tells the commonjs plugin these are ESM packages, and
 * `requireReturnsDefault: "namespace"` makes it generate
 * `import * as x from "uuid"; export default x;` — a namespace import that
 * works with ESM-only packages.
 */
const ESM_EXTERNAL_PACKAGES = ['uuid', 'msgpackr'];

export default defineConfig({
  plugins: [
    lucidePreprocess(),
    devtools(),
    nitro({
      commonJS: {
        esmExternals: ESM_EXTERNAL_PACKAGES,
        requireReturnsDefault: 'namespace',
      },
      rollupConfig: {
        external: ESM_EXTERNAL_PACKAGES,
      },
    }),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
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
    solidPlugin({ ssr: true }),
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
