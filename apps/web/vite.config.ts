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

// Some dependencies use require() or createRequire() to load modules/JSON
// at init time. When Vite/Nitro bundles them into ESM output, these calls
// fail at runtime because .output/ has no node_modules:
//
// - turndown (via defuddle): require("@mixmark-io/domino")
// - css-tree v3 (via jsdom): createRequire()("../data/patch.json"),
//   createRequire()("mdn-data/css/*.json")
// - css-tree v2 (via csso): require("./data-patch.cjs")
//
// Fix: replace require() calls with ESM imports during the transform phase
// so the bundler resolves and inlines the dependencies.
function cjsRequireToImport(): Plugin {
  // "default" for JSON files (single default export),
  // "namespace" for CJS packages (import * as ...).
  const replacements: Record<string, { alias: string; style: 'default' | 'namespace' }> = {
    '@mixmark-io/domino': { alias: '__cjs_domino__', style: 'namespace' },
    '../data/patch.json': { alias: '__cjs_patch_json__', style: 'default' },
    './data-patch.cjs': { alias: '__cjs_patch_cjs__', style: 'namespace' },
    'mdn-data/css/at-rules.json': { alias: '__cjs_mdn_atrules__', style: 'default' },
    'mdn-data/css/properties.json': { alias: '__cjs_mdn_properties__', style: 'default' },
    'mdn-data/css/syntaxes.json': { alias: '__cjs_mdn_syntaxes__', style: 'default' },
  };

  return {
    name: 'cjs-require-to-import',
    apply: 'build',
    enforce: 'pre',
    transform(code, _id) {
      let changed = false;
      let transformed = code;
      let imports = '';

      for (const [pkg, { alias, style }] of Object.entries(replacements)) {
        const escaped = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`require\\s*\\(\\s*["']${escaped}["']\\s*\\)`, 'g');
        if (pattern.test(transformed)) {
          imports +=
            style === 'namespace'
              ? `import * as ${alias} from '${pkg}';\n`
              : `import ${alias} from '${pkg}';\n`;
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
