# Nitro Server Bundling: Externalization Strategy

**Date:** 2026-03-29 (updated 2026-04-03)
**Status:** Active — externalization with `rollupConfig.external` + full `node_modules` in Docker

## Summary

Nitro's Vite builder bundles all server dependencies into `.mjs` chunks. Some packages (jsdom, css-tree, @mixmark-io/domino) break when bundled because they read sibling files at runtime via relative paths. We externalize those packages via `rollupConfig.external` and ship the full pruned monorepo (`out/`) — including `node_modules` — in the Docker image so they resolve naturally.

## Current Strategy

### What happens at build time

1. **Turborepo prune** → produces `out/` with only the packages needed for the target app
2. **`bun install`** inside `out/` → installs dependencies (hoisted `node_modules/`)
3. **Vite/Nitro build** → bundles server code into `apps/web/.output/server/`
4. **Docker `COPY out/ ./`** → the entire pruned monorepo (including `node_modules/`) lands in the image

### What gets bundled vs externalized

| Package | Bundled? | Why |
|---|---|---|
| Most deps (uuid, msgpackr, svix, react, solid-js, etc.) | ✅ Bundled into `_libs/*.mjs` | No CJS/asset issues |
| `jsdom` | ❌ External | Reads companion files at runtime; `__dirname` references break when bundled |
| `css-tree` | ❌ External | Uses `createRequire` + relative paths to load JSON data files |
| `@mixmark-io/domino` | ❌ External | Required by turndown via `require()` inside a function body that Rollup can't convert |

Externalized packages emit bare `import "jsdom"` / `require("@mixmark-io/domino")` in the output. These resolve from `/app/node_modules/` in the Docker container.

### How externalization works in Nitro's Vite builder

Nitro's Vite builder **hardcodes `noExternal: true`** in production (line 329 of `nitro/dist/vite.mjs`). The `noExternals` option in the `nitro()` Vite plugin config only affects the Rollup builder path — it does nothing for the Vite builder.

The only way to prevent bundling is **`rollupConfig.external`** — this is passed through as `build.rollupOptions.external` to Vite, telling Rollup to emit bare imports instead of inlining the package.

### CJS-in-ESM interop (esmExternals)

Some packages (svix → uuid, msgpackr) are ESM-only but consumed via `require()` in CJS code. Without configuration, `@rollup/plugin-commonjs` generates `import x from "uuid"` (default import), which fails because uuid only has named exports.

Setting `esmExternals: ['uuid', 'msgpackr']` + `requireReturnsDefault: 'namespace'` makes the commonjs plugin generate `import * as x from "uuid"; export default x;` — a namespace import that works.

### Config reference

All bundling config lives in `apps/web/vite.config.ts` inside the `nitro()` plugin call. See inline comments there for specifics.

### Docker deployment

The Dockerfile copies the entire `out/` directory (not just `.output/`). This is consistent with `apps/worker/Dockerfile` and `apps/migrator/Dockerfile`. The CMD runs:

```sh
bun --bun run apps/web/.output/server/index.mjs
```

Working directory is `/app`, so `node_modules` resolves from `/app/node_modules/` (hoisted by `bunfig.toml`'s `linker = "hoisted"`).

### CI pipeline alignment

The GitHub Actions workflow (`.github/workflows/build-images.yml`) does `turbo prune → bun install → bun build → docker build`. The Docker build context is the `out/` directory. Same flow as `build-local.sh` for local testing.

## Debugging

1. **`Cannot find module 'X'` in production** — the package is externalized but missing from `node_modules` in the Docker image. Check that `turbo prune` includes it (it must be a dependency of a pruned package).

2. **CJS patterns crash** (`require is not defined`, `module is not defined`) — a CJS package was bundled but Rollup didn't fully convert it. Options:
   - Add it to `rollupConfig.external` if it has runtime file dependencies
   - If it's a simple CJS-to-ESM conversion failure, Rollup usually handles it — check if the package has a newer version with proper ESM

3. **Build locally**: `./build-local.sh web` then inspect `apps/web/.output/server/` or `docker run --rm openfeeds-web:local <command>`.

4. **Verify externalization**: grep the output for bare imports — `grep -r "packagename" apps/web/.output/server/ --include="*.mjs"`. External packages appear as `import "X"` (not inlined).

---

## Historical Context

> What follows documents the **previous strategy** (pre-April 2026) where all dependencies were bundled and CJS issues were fixed with build plugins + pnpm patches. This context explains WHY we moved to externalization.

### The old approach (~327 lines in vite.config.ts)

Before externalization, the Dockerfile only copied `.output/server/` — no `node_modules`. Since Nitro forces `noExternal: true`, every dependency had to survive bundling. This required:

- **`cjsShimPlugin()`** (~60 lines) — post-processed all `.mjs` output files, injecting `require` (via `createRequire`), `module`, `__dirname`, `__filename` into any file containing CJS patterns. 11 output files needed this.
- **`wasmCopyPlugin()`** — copied WASM files that Rollup doesn't follow (htmlrewriter's `.wasm` loaded via `readFileSync`)
- **pnpm patch on turndown** — replaced `require('@mixmark-io/domino')` with `import` in turndown's ESM build (Rollup can't convert `require()` inside function bodies)
- **pnpm patch on css-tree** — replaced `createRequire` + relative JSON `require()` with `import ... with { type: 'json' }` so Rollup could inline the JSON
- **`process.env.NODE_ENV` define** — forced production mode across all Vite environments to tree-shake React's dev runtime (pulled in transitively via `@repo/domain` → `@repo/emails` → `react/jsx-runtime`)

### Why each problem existed

**turndown / @mixmark-io/domino**: turndown's ESM build (`lib/turndown.es.js`) contains a bare `require('@mixmark-io/domino')` — a [known upstream bug](https://github.com/mixmark-io/turndown/issues/502). Rollup eliminates the browser branch (`if (process.browser)`) but can't convert the remaining `require()` to `import` because it's inside a function body. With externalization, this `require()` resolves from `node_modules` at runtime — no patch needed.

**css-tree**: v3's ESM build uses `createRequire(import.meta.url)` to load JSON data files with relative paths. After bundling into `_libs/css-tree.mjs`, the relative path resolves against the wrong directory. With externalization, css-tree runs from `node_modules` with its files intact — no patch needed.

**React jsx-dev-runtime**: `@react-email/components` bundles both prod and dev variants of `react/jsx-runtime`. The dev variant calls `createRequire` + `require("react")` which fails without `node_modules`. The `@repo/domain` barrel re-export pulled this into every server function. With externalization, React is fully bundled into `_libs/react.mjs` (production mode) and the dev variant is tree-shaken — no explicit define needed.

**htmlrewriter WASM**: htmlrewriter loads a `.wasm` file via `readFileSync` relative to `import.meta.url`. Rollup bundles the JS but not the companion WASM. With externalization, htmlrewriter itself is still bundled (no CJS issues), but if it were externalized, its WASM would resolve from `node_modules`.

**General CJS-in-ESM**: Packages like jsdom, undici, ajv have `module.exports`, `__dirname`, lazy `require()` for Node builtins. The CJS shim made these work. With externalization, the worst offenders (jsdom) run from `node_modules` directly; the rest survive Rollup's conversion without a shim.

### Why we moved away

The old strategy was brittle:
- Every new CJS dependency could introduce a production crash
- pnpm patches break on upstream version bumps
- The shim plugin was a build-time hack working around Nitro's `noExternal: true`
- ~250 lines of build plugins for problems that don't exist when packages run from `node_modules`

Externalization trades a larger Docker image (includes `node_modules`) for zero build plugins and zero patches. The image size increase is acceptable for a VPS deployment (see [VPS decision](./2026-02-07-vps-over-cloudflare-workers.md)).

### Ecosystem issues (still open)

- [nitrojs/nitro#4113](https://github.com/nitrojs/nitro/issues/4113) — Vite builder doesn't set `platform: "node"`, breaking CJS interop
- [nitrojs/nitro#4053](https://github.com/nitrojs/nitro/issues/4053) — Bundling `readable-stream` (CJS) breaks prototype chains
- [nitrojs/nitro#3800](https://github.com/nitrojs/nitro/issues/3800) — Externalized packages lose `.js` extensions
- [mixmark-io/turndown#502](https://github.com/mixmark-io/turndown/issues/502) — turndown's ESM build contains `require()`

Related PRs: #181, #183, #200, #202, #204, #206
