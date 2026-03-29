import { readFileSync } from 'node:fs';
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

/**
 * CJS packages with dynamic require() calls that Rollup can't statically trace.
 *
 * These MUST be handled by nf3 (Nitro's dependency tracer) — NOT by
 * rollupConfig.external — so that nf3 both externalizes them AND copies them
 * to .output/server/node_modules/. If placed in rollupConfig.external instead,
 * Rollup externalizes them before nf3 ever sees them, so nf3 never traces or
 * copies them, and they're missing at runtime.
 *
 * They also need ssr.external so Vite's SSR bundle externalizes them too.
 *
 * Packages that are only dynamically required at runtime (e.g. inside a
 * try-catch) and never statically imported won't be seen by nf3 even with
 * traceDeps. For those, we inject a synthetic import via a virtual Rollup
 * module so nf3 can discover and trace them (see forceTracePlugin below).
 *
 * turndown → @mixmark-io/domino: turndown conditionally requires domino at
 * runtime (Node.js fallback when DOMParser is unavailable). defuddle depends
 * on turndown but doesn't declare it in its package.json.
 * See: #181, #183
 */
const NF3_TRACED_CJS_PACKAGES = ['turndown', '@mixmark-io/domino'];

/**
 * Rollup plugin that injects a virtual module importing packages so nf3 can
 * discover and trace them. Without this, packages only referenced via dynamic
 * require() at runtime (e.g. `require('@mixmark-io/domino')` inside turndown)
 * would never be seen by nf3's static analysis and would be missing from
 * .output/server/node_modules/.
 */
function forceTracePlugin(packages: string[]): Plugin {
  const virtualId = '\0force-trace';
  return {
    name: 'nitro:force-trace',
    resolveId(id) {
      if (id === virtualId) return virtualId;
    },
    load(id) {
      if (id === virtualId) {
        return packages.map((pkg) => `import ${JSON.stringify(pkg)};`).join('\n');
      }
    },
    // Inject the virtual module as an entry point so Rollup processes it
    buildStart() {
      this.emitFile({ type: 'chunk', id: virtualId, name: 'force-trace' });
    },
  };
}

export default defineConfig({
  ssr: {
    // Externalize from the Vite SSR bundle (_ssr/index.mjs)
    external: NF3_TRACED_CJS_PACKAGES,
  },
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
        plugins: [forceTracePlugin(NF3_TRACED_CJS_PACKAGES)],
      },
      // Let nf3 externalize AND trace these so they end up in
      // .output/server/node_modules/ (see NF3_TRACED_CJS_PACKAGES comment)
      traceDeps: NF3_TRACED_CJS_PACKAGES,
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
