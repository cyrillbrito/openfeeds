import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import lucidePreprocess from 'vite-plugin-lucide-preprocess';
import solidPlugin from 'vite-plugin-solid';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    lucidePreprocess(),
    devtools(),
    nitro({
      rollupConfig: {
        // Externalize @modelcontextprotocol/sdk and its CJS-only transitive
        // deps (ajv, ajv-formats). Bundling them triggers a Rollup crash
        // ("null is not an object — target.getVariableForExportName") during
        // the Nitro build because Rollup can't reconcile their module graphs.
        // These packages are available at runtime via node_modules.
        external: [/^@modelcontextprotocol\/sdk/, /^ajv/, /^ajv-formats/, /^zod-to-json-schema/],
      },
    }),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    solidPlugin({ ssr: true }),
  ],
  server: {
    allowedHosts: true,
  },
});
