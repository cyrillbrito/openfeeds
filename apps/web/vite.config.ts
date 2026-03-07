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
    nitro({
      rollupConfig: {
        // These packages must be externalized because Rollup's CJS-to-ESM conversion
        // generates default imports (e.g. `import x from "uuid"`) but these packages
        // only have named exports. This causes "Missing 'default' export" errors at runtime.
        external: ['uuid', 'msgpackr'],
      },
    }),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
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
