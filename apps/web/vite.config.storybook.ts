import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import lucidePreprocess from 'vite-plugin-lucide-preprocess';
import solidPlugin from 'vite-plugin-solid';
import viteTsConfigPaths from 'vite-tsconfig-paths';

// Minimal Vite config for Storybook — no server-side plugins (Nitro, TanStack
// Start, devtools) that pull in @repo/db → bun APIs unavailable in Node.
export default defineConfig({
  plugins: [
    lucidePreprocess(),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    solidPlugin({ ssr: false }),
  ],
  optimizeDeps: {
    // CJS-only packages pulled in by the markdown pipeline
    // (solid-markdown → unified → extend, remark-gfm → micromark → debug).
    // Pre-bundle them so Vite converts to ESM for both dev and Storybook.
    include: ['debug', 'extend'],
  },
});
