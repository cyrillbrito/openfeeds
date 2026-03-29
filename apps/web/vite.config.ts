import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
import { nitro } from 'nitro/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import lucidePreprocess from 'vite-plugin-lucide-preprocess';
import solidPlugin from 'vite-plugin-solid';
import viteTsConfigPaths from 'vite-tsconfig-paths';

const rootPkg = JSON.parse(readFileSync('../../package.json', 'utf-8'));

/**
 * Vite plugin that injects CJS compatibility shims into server bundles.
 *
 * When Vite/Nitro bundles CJS dependencies into ESM output, CJS globals
 * (require, module, module.exports, __dirname, __filename) are undefined.
 * This plugin post-processes ALL .mjs files in .output/server/ after the
 * build completes, injecting shims into any file that contains CJS patterns.
 *
 * Post-processing (writeBundle) is used instead of renderChunk because:
 * 1. renderChunk only sees chunks from its own build pipeline (SSR or Nitro,
 *    not both), missing chunks from the other pipeline
 * 2. Rollup's scope analysis renames injected identifiers (e.g. require →
 *    require2) to avoid conflicts with existing bindings
 *
 * Affected dependency chains include:
 * - defuddle → turndown → @mixmark-io/domino (require)
 * - jsdom → css-tree v3 (createRequire, module.exports)
 * - jsdom → csso → css-tree v2 (require)
 * - undici (module.exports, require)
 * - ajv (require, module.exports)
 *
 * See: #181, #183, #200, #202, #204
 */
function cjsShimPlugin(): Plugin {
  const CJS_PATTERN = /\brequire\s*\(|(?<!\.\w*)module\.exports\b|\b__dirname\b|\b__filename\b/;

  const shim = [
    '/* CJS compatibility shim - injected by cjsShimPlugin */',
    'import { createRequire as __cjs_createRequire__ } from "node:module";',
    'import { fileURLToPath as __cjs_fileURLToPath__ } from "node:url";',
    'import { dirname as __cjs_dirname__ } from "node:path";',
    'const __filename = __cjs_fileURLToPath__(import.meta.url);',
    'const __dirname = __cjs_dirname__(__filename);',
    'const require = __cjs_createRequire__(import.meta.url);',
    'const module = { exports: {} };',
    '',
  ].join('\n');

  function walkMjs(dir: string): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        files.push(...walkMjs(full));
      } else if (full.endsWith('.mjs')) {
        files.push(full);
      }
    }
    return files;
  }

  return {
    name: 'cjs-shim',
    apply: 'build',
    // closeBundle runs after all files are written to disk. At this point
    // both SSR and Nitro builds are complete and we can rewrite any file.
    closeBundle() {
      const serverDir = join(process.cwd(), '.output', 'server');
      let stat;
      try {
        stat = statSync(serverDir);
      } catch {
        return; // .output/server/ doesn't exist (e.g. dev mode)
      }
      if (!stat.isDirectory()) return;

      const files = walkMjs(serverDir);
      let injected = 0;

      for (const file of files) {
        const code = readFileSync(file, 'utf-8');
        // Skip files that already have the shim
        if (code.includes('__cjs_createRequire__')) continue;
        // Skip files without CJS patterns
        if (!CJS_PATTERN.test(code)) continue;

        writeFileSync(file, shim + code);
        injected++;
      }

      if (injected > 0) {
        // eslint-disable-next-line no-console
        console.log(`[cjs-shim] Injected CJS shim into ${injected} server chunks`);
      }
    },
  };
}

/**
 * Vite plugin that rewrites CJS require() calls to ESM imports at build time.
 *
 * Some bundled dependencies contain dynamic require() calls that Rollup can't
 * statically analyze. Without this transform, the CJS shim provides a working
 * require() function, but the required package isn't in .output/node_modules.
 *
 * This plugin converts require() calls to top-level ESM imports so Rollup can
 * trace, tree-shake, and bundle the dependency code into the output chunks.
 *
 * Each entry maps a require specifier to a unique import variable name.
 */
function cjsRequireToImportPlugin(): Plugin {
  // Map of require("specifier") → ESM import variable name
  const rewrites: Record<string, string> = {
    '@mixmark-io/domino': '__cjs_domino__',
  };

  const requirePattern = new RegExp(
    `require\\(["'](${Object.keys(rewrites)
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})["']\\)`,
    'g',
  );

  return {
    name: 'cjs-require-to-import',
    apply: 'build',
    transform(code, _id) {
      if (!requirePattern.test(code)) return null;
      requirePattern.lastIndex = 0;

      // Collect which packages are required in this module
      const needed = new Set<string>();
      let transformed = code.replace(requirePattern, (_match, specifier: string) => {
        needed.add(specifier);
        return rewrites[specifier]!;
      });

      // Prepend ESM imports for each required package
      const imports = [...needed]
        .map((spec) => `import * as ${rewrites[spec]} from ${JSON.stringify(spec)};`)
        .join('\n');

      transformed = imports + '\n' + transformed;

      return { code: transformed, map: null };
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
    cjsRequireToImportPlugin(),
    cjsShimPlugin(),
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
