# Dependency & Bundle Analysis

How to inspect package deps, build graphs, and bundle composition in this repo.

## 1. Turbo package graph

Build-order graph across all workspace packages.

```bash
bun turbo run build --graph=graph.html   # interactive
bun turbo run build --graph               # raw .dot to stdout
bun turbo run build --graph=graph.svg     # needs graphviz installed
```

Useful flags:

- `--filter=@repo/web...` — only show deps of a package
- `--dry-run=json` — full task+dep JSON to grep
- `bun turbo ls --filter=@repo/<pkg>` — quick text dep list

**Caveat:** Turbo's graph shows _build_ deps from `package.json`. A `dependencies` entry used only as `import type` still appears as a build edge but ships **0 bytes**. Always cross-check with the bundle analyzer before concluding a package "leaks".

## 2. Web bundle analyzer (source-map-explorer, zero-touch)

**No Vite config changes needed.** `apps/web/vite.config.ts` already emits sourcemaps (`sourcemap: 'hidden'`). Run after a normal build:

```bash
bun --filter @repo/web build
bunx source-map-explorer 'apps/web/dist/assets/*.js' \
  --html apps/web/dist/sme.html --gzip --no-border-checks
open apps/web/dist/sme.html
```

Interactive treemap with gzip sizes, grouped by `node_modules/<pkg>` and source paths. Sourcemap-attribution warnings are expected and cosmetic — the report still generates.

**Limitations vs `rollup-plugin-visualizer`:** workspace-package fidelity is lower (most `packages/*` code gets folded into route chunks via sourcemap glitches), and brotli sizes are unavailable. Good enough for the main use case: spotting server-only deps in the browser bundle.

If you need richer workspace-package attribution one-off, temporarily install `rollup-plugin-visualizer` and add it to `vite.config.ts` under `process.env.ANALYZE`, then remove afterwards. Don't commit it.

**What to check:**

- `node_modules` list — server-only deps that must **never** appear: `bullmq`, `drizzle-orm`, `pg`, `postgres`, `ioredis`, `nodemailer`, `@react-email/*`, `jsdom`, `@mozilla/readability`, `undici`.
- Workspace code from `packages/domain`, `packages/db`, `packages/auth` is a leak candidate. Schemas and shared types are fine; queues, AI clients, DB drivers are not.
- Top 10 by gzip — reveals lazy-load opportunities (analytics, large JSON, optional features).

## 3. Reverse-lookup an import

When the analyzer flags a suspicious module, find _why_ it's bundled:

```bash
rg "from ['\"]@repo/server" apps/web/src    # should only be `import type`
rg "from ['\"]@repo/domain" apps/web/src
```

For deeper chains use Vite's `--debug` build output.

## 4. Unused dependencies

```bash
bunx depcheck apps/web                       # per-app
bunx knip                                    # whole monorepo, more thorough
```

Knip also finds unused exports and files. Run occasionally; don't auto-fix without review (false positives on dynamic imports, route files, plugin entries).

## 5. Heuristics for this codebase

- `@repo/server` in `apps/web/package.json` is expected — types only. Bundle should show 0 bytes from it.
- `@repo/domain` in the web bundle should only be Zod schemas (`*.schema.ts`) and `version.ts`. Anything else means a non-type import slipped through a barrel re-export.
- `hono` ~3 KB in the web bundle is the `hc` RPC client; expected.
- Turbo build edges ≠ runtime bundle deps. Always confirm with the analyzer.

## Standard workflow

1. `bun turbo run build --graph=graph.html` — visual sanity check of build-order deps.
2. `bun --filter @repo/web build && bunx source-map-explorer 'apps/web/dist/assets/*.js' --html apps/web/dist/sme.html --gzip --no-border-checks` — see what _actually_ ships.
3. Cross-reference: every workspace package in the graph that's _not_ a leaf — does it appear in the bundle? In what size? Is that size justified?
4. For suspects, `rg` the imports in the consuming app to confirm `import type` vs runtime.
5. `bunx knip` for unused-export cleanup.
