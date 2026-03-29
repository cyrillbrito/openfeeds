import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
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
 * - jsdom → css-tree v3 (createRequire, module.exports)
 * - jsdom → csso → css-tree v2 (require)
 * - undici (module.exports, require)
 * - ajv (require, module.exports)
 *
 * The defuddle → turndown → @mixmark-io/domino chain is fixed via pnpm patch
 * on turndown (replacing require() with import in the ESM build).
 *
 * See: docs/decisions/2026-03-29-nitro-cjs-esm-bundling.md
 */

/** Recursively collect all .mjs files under a directory. */
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
 * Vite plugin that copies WASM files referenced by bundled server code.
 *
 * Some dependencies (e.g. htmlrewriter) load .wasm files at runtime via
 * fs.readFileSync with a path relative to import.meta.url. Rollup bundles
 * the JS but does NOT copy companion .wasm files into .output/server/.
 *
 * Why not alias to a bundler-friendly entry or use Nitro's unwasm?
 * - Nitro aliases apply to ALL Vite environments (SSR + Nitro) via
 *   sharedDuringBuild, but only the Nitro environment has the unwasm plugin.
 *   The SSR environment fails with "ESM integration proposal for Wasm is not
 *   supported" when it encounters `import wasm from '...wasm'`.
 * - Nitro's unwasm only intercepts `import '...wasm'` patterns, not
 *   fs.readFileSync calls that the "node" export condition uses.
 *
 * This plugin runs after both builds complete, scans bundled .mjs files for
 * `new URL("...wasm", import.meta.url)` patterns, and copies the source .wasm
 * file from node_modules to the expected location in the output directory.
 *
 * See: docs/decisions/2026-03-29-nitro-cjs-esm-bundling.md
 */
function wasmCopyPlugin(): Plugin {
  // Matches: new URL("./dist/foo.wasm", import.meta.url) or new url$1.URL("foo.wasm", import.meta.url)
  // Rollup may rename `url` to `url$1` etc. ($ is not a \w char), so we use \S+ for the namespace.
  // The (?:\S+\.)? group makes the namespace optional to also match plain `new URL(...)`.
  const WASM_URL_PATTERN = /new\s+(?:\S+\.)?URL\(\s*"([^"]+\.wasm)"\s*,\s*import\.meta\.url\s*\)/g;

  return {
    name: 'wasm-copy',
    apply: 'build',
    closeBundle() {
      const serverDir = join(process.cwd(), '.output', 'server');
      try {
        if (!statSync(serverDir).isDirectory()) return;
      } catch {
        return;
      }

      // Resolve WASM source paths from node_modules. htmlrewriter is a dep of
      // @repo/domain (not apps/web), so we resolve from the domain package.
      const domainRequire = createRequire(resolve('../../packages/domain/package.json'));
      const wasmSources: Record<string, string> = {};
      try {
        const htmlrewriterDir = dirname(domainRequire.resolve('htmlrewriter'));
        wasmSources['html_rewriter_bg'] = join(htmlrewriterDir, 'dist', 'html_rewriter_bg.wasm');
      } catch {
        // htmlrewriter not installed
      }

      const files = walkMjs(serverDir);
      let copied = 0;

      for (const file of files) {
        const code = readFileSync(file, 'utf-8');
        const fileDir = dirname(file);

        let match;
        WASM_URL_PATTERN.lastIndex = 0;
        while ((match = WASM_URL_PATTERN.exec(code)) !== null) {
          const relativePath = match[1]!;
          const targetPath = resolve(fileDir, relativePath);

          // Skip if already exists
          if (existsSync(targetPath)) continue;

          // Look up source by basename (without extension)
          const baseName = relativePath.replace(/.*\//, '').replace(/\.wasm$/, '');
          const sourcePath = wasmSources[baseName];
          if (!sourcePath || !existsSync(sourcePath)) {
            // eslint-disable-next-line no-console
            console.warn(
              `[wasm-copy] Cannot find source for ${relativePath} referenced in ${file}`,
            );
            continue;
          }

          mkdirSync(dirname(targetPath), { recursive: true });
          copyFileSync(sourcePath, targetPath);
          copied++;
        }
      }

      if (copied > 0) {
        // eslint-disable-next-line no-console
        console.log(`[wasm-copy] Copied ${copied} WASM file(s) to server output`);
      }
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
    cjsShimPlugin(),
    wasmCopyPlugin(),
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
