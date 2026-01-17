import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  manifest: {
    name: 'OpenFeeds',
    description: 'Discover and follow RSS feeds from any website',
    permissions: ['activeTab', 'storage'],
    host_permissions: [
      'http://localhost:*/*',
      'https://openfeeds.app/*',
      'https://*.openfeeds.app/*',
    ],
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '128': 'icon/128.png',
    },
  },
  dev: {
    server: {
      port: 3003,
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
