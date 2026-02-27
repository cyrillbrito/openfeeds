import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/solid-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';
import lucidePreprocess from 'vite-plugin-lucide-preprocess';
import solidPlugin from 'vite-plugin-solid';
import viteTsConfigPaths from 'vite-tsconfig-paths';

const rootPkg = JSON.parse(readFileSync('../../package.json', 'utf-8'));

export default defineConfig({
  plugins: [
    lucidePreprocess(),
    devtools(),
    nitro(),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
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
    // Permissive CORS in dev for browser-based tools like MCP Inspector.
    // Vite's built-in CORS middleware runs before Nitro's proxy, which also
    // prevents Nitro from crashing on OPTIONS preflight requests.
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id', 'Mcp-Protocol-Version'],
      exposedHeaders: ['Mcp-Session-Id', 'Mcp-Protocol-Version'],
      maxAge: 86400,
    },
  },
});
