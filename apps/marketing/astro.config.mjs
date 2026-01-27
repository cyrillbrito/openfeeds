// @ts-check
import cloudflare from '@astrojs/cloudflare';
import solidJs from '@astrojs/solid-js';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },

    // cloudflare's service requires some more config, disabled for now
    imageService: 'compile',

    routes: {
      extend: {
        exclude: [
          // Email assets served directly
          { pattern: '/_emails/*' },
        ],
      },
    },
  }),

  integrations: [solidJs()],

  vite: {
    plugins: [tailwindcss()],
  },
});
