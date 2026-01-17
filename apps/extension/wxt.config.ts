import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  manifest: {
    name: 'OpenFeeds',
    description: 'Discover and follow RSS feeds from any website',
    permissions: ['activeTab', 'storage'],
    host_permissions: ['http://localhost:3001/*', 'https://*.openfeeds.com/*'],
  },
  dev: {
    server: {
      port: 3003,
    },
  },
  webExt: {
    startUrls: ['https://example.com'],
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
