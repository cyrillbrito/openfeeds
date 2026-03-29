import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { type Plugin, defineConfig } from 'vite';
import lucidePreprocess from 'vite-plugin-lucide-preprocess';
import solidPlugin from 'vite-plugin-solid';
import viteTsConfigPaths from 'vite-tsconfig-paths';

const rootPkg = JSON.parse(readFileSync('../../package.json', 'utf-8'));

// Some dependencies (e.g. turndown via defuddle) ship CJS with bare
// require() calls. When Vite/Nitro bundles them into ESM output, these
// calls fail at runtime ("require is not defined in ES module scope").
//
// turndown specifically does: var domino = require("@mixmark-io/domino")
// This is executed at module initialization (not lazily), and the Nitro
// .output/ directory has no node_modules for require() to resolve from.
//
// Fix: replace the require("@mixmark-io/domino") call with an ESM import
// during the transform phase so the bundler inlines domino's code.
function cjsRequireToImport(): Plugin {
  const replacements: Record<string, string> = {
    '@mixmark-io/domino': '__cjs_domino__',
  };

  return {
    name: 'cjs-require-to-import',
    apply: 'build',
    enforce: 'pre',
    transform(code, _id) {
      let changed = false;
      let transformed = code;
      let imports = '';

      for (const [pkg, alias] of Object.entries(replacements)) {
        const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`require\\s*\\(\\s*["']${escaped}["']\\s*\\)`, 'g');
        if (pattern.test(transformed)) {
          imports += `import * as ${alias} from '${pkg}';\n`;
          transformed = transformed.replace(pattern, alias);
          changed = true;
        }
      }

      if (changed) {
        return { code: imports + transformed, map: null };
      }
      return null;
    },
  };
}

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
    cjsRequireToImport(),
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
