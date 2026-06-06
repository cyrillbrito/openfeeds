// @ts-check
import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
//
// Static output. Served by the Hono server (apps/server/) from
// `apps/marketing/dist/` — see the marketing-dist routing block in
// apps/server/src/index.ts. There is no Astro runtime in production;
// per-request logic (the waitlist signup) lives in the Hono server.
export default defineConfig({
  output: 'static',

  integrations: [solidJs()],

  vite: {
    plugins: [tailwindcss()],
  },
});
