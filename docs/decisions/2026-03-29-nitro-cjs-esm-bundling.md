# Nitro CJS-in-ESM Bundling Issues

**Date:** 2026-03-29
**Status:** Active workarounds in place
**Context:** Production crashes from CJS-in-ESM bundling issues and missing WASM files after Nitro bundles all dependencies into `.output/server/`

## The Problem

Nitro (via Vite/Rollup) bundles server-side dependencies into ESM `.mjs` files in `.output/server/`. Some npm packages contain CJS code (`require()`, `module.exports`, `__dirname`, `__filename`) that Rollup fails to fully convert to ESM during bundling. The result: ESM files with leftover CJS patterns that crash at runtime because `require`, `module`, `__dirname`, etc. don't exist in ESM.

This is not a bug in our code. It's a known ecosystem-wide CJS/ESM interop problem that affects every Rollup-based bundler (Vite, Nitro, Nuxt, etc.) when consuming CJS packages.

## Why It Happens

1. Rollup's `@rollup/plugin-commonjs` converts top-level `require()` to `import`, but **misses `require()` calls inside function bodies** because it can't statically analyze them. It also leaves behind `module.exports`, `__dirname`, and `__filename` references in some cases.
2. Nitro outputs `.mjs` files (ESM). In Node.js ESM, `require`, `module`, `__dirname`, and `__filename` are undefined — they're CJS-only globals.
3. In dev mode this never surfaces because Vite doesn't bundle server code — Node.js loads packages directly from `node_modules` and handles CJS/ESM interop natively.

## Why We Can't Externalize

When using `nitro/vite` (the Vite plugin, which TanStack Start uses), Nitro **forces `noExternal: true` for production builds**. This is hardcoded in the Vite builder path:

```js
// nitro/dist/vite.mjs
noExternal: ctx.nitro.options.dev ? [...] : true,
```

This means ALL dependencies are bundled into the output — there is no `.output/server/node_modules/`. Externalizing specific packages via `rollupConfig.external` does not help because there's no `node_modules` to resolve them from at runtime.

This is different from Nitro's standalone Rollup builder, which has an externals plugin with nft (node-file-trace) to auto-detect, externalize, and copy needed packages. The Vite builder skips all of that.

**Consequence:** any CJS patterns that Rollup fails to convert will be broken in production. We must fix them at the source or patch them during build.

## Affected Dependencies

| Dependency Chain | CJS Pattern | Fix |
|---|---|---|
| `defuddle` → `turndown` → `@mixmark-io/domino` | `require()` in turndown's ESM build | **pnpm patch** on turndown |
| `jsdom`, `data-urls`, `whatwg-url`, `debug`, `decimal.js` | `module.exports` | CJS shim plugin |
| `undici` | `require("node:http2")`, `require("node:tls")` | CJS shim plugin |
| `ajv`, `ajv-formats` | `require("ajv/dist/...")` | CJS shim plugin |
| `jsdom` | `__dirname` | CJS shim plugin |
| `mixmark-io/domino` | `module.exports` | CJS shim plugin |
| `htmlrewriter` | `.wasm` file not copied to output | WASM copy plugin |

Related PRs: #181, #183, #200, #202, #204, #206

## The defuddle/turndown Problem (pnpm patch)

This one is special and can't be fixed by the CJS shim alone.

**Root cause:** turndown's ESM build (`lib/turndown.es.js`) contains a bare `require('@mixmark-io/domino')`. This is a [known bug](https://github.com/mixmark-io/turndown/issues/502) in turndown's Rollup build config. The source code uses `require()` inside a conditional branch (`if (process.browser) ... else { require(...) }`). Rollup correctly dead-code-eliminates the browser branch for the Node.js ESM build, but fails to convert the remaining `require()` to `import` because it's inside a function body, not at the top level.

Replacing `require` with `import` is the correct fix — not a workaround. The `require()` is not conditional, not dynamic, not lazy. After branch elimination it's just a plain unconditional dependency load that should have been an `import` in the ESM build.

**Why the shim isn't enough:** The CJS shim injects `const require = createRequire(import.meta.url)` into the output `.mjs` files, which makes `require()` work syntactically. But `require()` resolves from the **file's location** (`.output/server/`), and `@mixmark-io/domino` is not a separate file there — it was supposed to be bundled inline by Rollup, but Rollup couldn't trace the dynamic `require()` call to bundle it. So `require('@mixmark-io/domino')` fails with `Cannot find module` even with the shim.

**Why patch turndown, not defuddle:** defuddle doesn't declare turndown as a dependency — it bundles turndown into its own dist. But the `require('@mixmark-io/domino')` comes from turndown's source, which defuddle consumes. Patching turndown at the source (replacing `require` with `import` in `lib/turndown.es.js`) fixes it for both direct users and consumers like defuddle.

**Fix:** `pnpm patch turndown` — change the one `require('@mixmark-io/domino')` to an `import` in `lib/turndown.es.js`.

After patching, remove the `cjsRequireToImportPlugin` from `apps/web/vite.config.ts` — it was specifically built to rewrite this one `require()` call.

## The CJS Shim Plugin (required, can't remove)

`cjsShimPlugin()` in `apps/web/vite.config.ts` post-processes all `.mjs` files in `.output/server/` after build, injecting CJS compatibility globals into any file that contains CJS patterns.

The shim injects:
- `require` — via `createRequire(import.meta.url)` from `node:module`
- `module` — `{ exports: {} }`
- `__dirname` and `__filename` — via `fileURLToPath` and `dirname`

**Why we can't remove it:** Since `noExternal: true` is hardcoded in Nitro's Vite builder, all deps are bundled. 11 output files currently contain CJS patterns that would crash without the shim. These are not broken ESM builds (like turndown) — they're CJS packages where Rollup's commonjs plugin converted *most* of the code but left behind some patterns it couldn't fully transform (e.g., `module.exports` assignments, lazy `require()` for Node.js builtins, `__dirname` references).

The shim works for these because:
- `require("node:http2")` and `require("node:tls")` — Node.js builtins, always available via `createRequire`
- `require("ajv/dist/...")` — these are self-references within the bundled ajv code; Rollup inlined the code but left the `require()` calls as runtime code generation strings (ajv uses them to generate validation functions). The `require` from `createRequire` can resolve them from `node_modules`.
- `module.exports` — the shim provides a dummy `module` object. The assignments don't crash, and the actual exports use ESM `export` statements that Rollup generated.
- `__dirname` — jsdom uses it to locate a CSS file. The shim provides the correct directory path.

**This plugin is ~60 lines, runs only at build time, and automatically handles any new CJS dep that Rollup mishandles.** It's the pragmatic solution given Nitro's `noExternal: true` constraint.

## How to Debug Future Occurrences

1. **The error looks like:** `Cannot find module 'X'` or `require is not defined` or `module is not defined` in production logs, with a stack trace pointing to `.output/server/*.mjs`.

2. **Build locally and check:** Run `pnpm build` in `apps/web/`, then `node .output/server/index.mjs` to reproduce locally.

3. **Identify the source:** The stack trace shows which `.mjs` file has the problem. Open it and search for the CJS pattern (`require(`, `module.exports`, `__dirname`).

4. **Determine the fix:**
   - **If `require('some-package')` and the package isn't available** (like `@mixmark-io/domino`) — the package was supposed to be bundled but Rollup missed it. Fix: **pnpm patch** the upstream package to use `import` instead of `require`. Then add an entry to `cjsRequireToImportPlugin` as a temporary build-time rewrite if you need an immediate fix before patching.
   - **If the CJS shim should have caught it but didn't** — check that the regex pattern in `cjsShimPlugin` matches the CJS pattern in the file. The shim only injects into files matching `CJS_PATTERN`.
   - **If the shim is there but `require()` can't find the module** — the module isn't in `node_modules` and isn't bundled. This is the turndown scenario. Must patch the source.
   - **If `ENOENT` for a `.wasm` file** — Rollup bundled the JS but not the companion WASM. Add the source WASM path to `wasmSources` in `wasmCopyPlugin()` and rebuild.

5. **Verify:** After fixing, rebuild and check `.output/server/` — grep for the pattern, confirm the shim is injected (look for `__cjs_createRequire__`).

## Ecosystem Context

This is not unique to our project. The Nitro v3 Vite builder has systemic CJS interop issues:

- **[nitrojs/nitro#4113](https://github.com/nitrojs/nitro/issues/4113)** — Vite builder doesn't set `platform: "node"`, breaking CJS interop for `@aws-sdk` and others. Open.
- **[nitrojs/nitro#4053](https://github.com/nitrojs/nitro/issues/4053)** — Bundling `readable-stream` (CJS) breaks prototype chains (`util.inherits`). Open.
- **[nitrojs/nitro#3800](https://github.com/nitrojs/nitro/issues/3800)** — Externalized packages lose `.js` extensions, breaking Node ESM resolution.
- **[mixmark-io/turndown#502](https://github.com/mixmark-io/turndown/issues/502)** — turndown's ESM build contains `require()`. No maintainer response.

Common workarounds others use: `rolldownConfig.external`, `nitro({ alias: {...} })`, per-package `pnpm patch`. Nobody has a clean blanket solution. Our CJS shim is actually more robust than most approaches since it handles all CJS deps automatically.

The real fix will come from Nitro/Rolldown improving CJS-to-ESM conversion, or the Vite builder supporting proper externalization with `node_modules` tracing (like the Rollup builder already does).

## The htmlrewriter WASM Problem (wasmCopyPlugin)

`htmlrewriter` (used in `@repo/domain` for HTML meta tag extraction) ships a `.wasm` file that it loads at runtime. When Nitro bundles the JS, the companion WASM file is **not** copied to `.output/server/`, causing `ENOENT: html_rewriter_bg.wasm` at runtime.

### Why It Happens

htmlrewriter has two entry points controlled by Node.js export conditions:

| Condition | Entry | WASM Loading |
|---|---|---|
| `"node"` | `node.mjs` | `fs.readFileSync` relative to `import.meta.url` |
| `"default"` | `default.js` | `import wasm from '...bg.wasm'` |

Nitro resolves the `"node"` condition, bundling `node.mjs`. Rollup inlines the JS but does not follow the `readFileSync` call to copy the WASM file — it's an opaque runtime string, not a static import.

### Alternatives Considered and Rejected

**Alias to `default.js` (the bundler-friendly entry):** Nitro's `alias` config applies to ALL Vite environments via `sharedDuringBuild: true` (line 568 in `nitro/dist/vite.mjs`). The `default.js` entry uses `import wasm from '...bg.wasm'`, which works in the Nitro environment (has `unwasm` plugin) but **fails in the SSR environment** with `"ESM integration proposal for Wasm is not supported"` because SSR does not have `unwasm`.

**Nitro's built-in `unwasm` plugin:** Only intercepts `import '...wasm'` patterns. Does not handle `fs.readFileSync` calls that the `"node"` export condition uses.

**Per-environment Vite plugin with `resolveId`:** Vite plugins need `sharedDuringBuild: true` and `applyToEnvironment` to work across environments. Even then, Nitro has its own resolution pipeline that may override plugin hooks. Too fragile.

### The Fix: wasmCopyPlugin

Same pattern as `cjsShimPlugin`. A `closeBundle` hook that runs after both SSR and Nitro builds complete:

1. Resolves the source WASM file from `node_modules` (via `createRequire` from the `@repo/domain` package, since htmlrewriter is its dependency, not `apps/web`'s).
2. Scans all `.mjs` files in `.output/server/` for `new URL("...wasm", import.meta.url)` patterns — the runtime WASM loading code that `node.mjs` uses.
3. Copies the source WASM to the expected relative path in the output directory.

The regex handles both plain `new URL(...)` and Rollup-renamed `new url$1.URL(...)` patterns (Rollup renames `url` to `url$1` etc. using `$` which is not a `\w` character).

Two copies are made because the bundled output has two different relative paths referencing the same WASM file:
- `html_rewriter_bg.wasm` (from the inline WASM import path)
- `./dist/html_rewriter_bg.wasm` (from the `node.mjs` `readFileSync` path)

### Adding Support for Other WASM Dependencies

If a new dependency loads WASM via `new URL("...wasm", import.meta.url)`, add its source path to the `wasmSources` map in `wasmCopyPlugin()` (keyed by WASM filename without extension). The plugin will automatically match and copy it.

## Current State of vite.config.ts

- `cjsShimPlugin()` — **keep**, required safety net for all CJS-in-ESM issues. Cannot be removed while Nitro Vite builder uses `noExternal: true`.
- `wasmCopyPlugin()` — **keep**, copies WASM files that Rollup doesn't bundle. Required for `htmlrewriter` and any future WASM-loading dependencies.
- `cjsRequireToImportPlugin()` — **removed**, replaced by pnpm patch on turndown.
