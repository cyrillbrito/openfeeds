import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { defineConfig, type Plugin } from 'vite';
import lucidePreprocess from 'vite-plugin-lucide-preprocess';
import solidPlugin from 'vite-plugin-solid';

const rootPkg = JSON.parse(readFileSync('../../package.json', 'utf-8'));

/**
 * Vite SPA. All server-side concerns (auth, MCP, well-known, entity
 * mutations, Electric shape proxies, OAuth provider) live in apps/server/
 * (Bun + Hono).
 *
 * The dev proxy forwards `/api/*` (everything Better Auth, Hono RPC, and
 * the Electric shape proxies use) to the server on :3401 so the browser
 * sees a single origin: no CORS, cookies just work, deep links survive page
 * refresh via `historyApiFallback` (Vite's SPA default).
 *
 * No `preview` block: prod-like runs (CI E2E, Docker) don't use `vite
 * preview` — the server serves the built SPA directly via `SERVE_SPA=true`.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    lucidePreprocess(),
    tanstackRouter({
      target: 'solid',
      autoCodeSplitting: true,
    }),
    tailwindcss(),
    solidPlugin(),
  ] as Plugin[],
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
  },
  build: {
    sourcemap: 'hidden',
  },
  server: {
    allowedHosts: true,
    proxy: {
      // Forward every api request to the Bun/Hono server. Includes:
      //   /api/auth/*       — Better Auth (sign-in, get-session, …)
      //   /api/shapes/*     — Electric SQL shape proxies
      //   /api/<entity>/*   — Hono RPC routes (feeds, articles, tags, …)
      //   /api/mcp/*        — MCP server
      //   /api/chat         — AI chat SSE stream
      '/api': { target: 'http://localhost:3401', changeOrigin: true, ws: true },
      // `.well-known/*` discovery documents also live on the server (RFC 8615).
      '/.well-known': { target: 'http://localhost:3401', changeOrigin: true },
    },
  },
});
