import { dirname } from 'path';
import { fileURLToPath } from 'url';
import type { StorybookConfig } from '@storybook/react-vite';

function getAbsolutePath(value: string) {
  return dirname(fileURLToPath(import.meta.resolve(`${value}/package.json`)));
}

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    getAbsolutePath('@storybook/addon-vitest'),
    getAbsolutePath('@storybook/addon-a11y'),
    getAbsolutePath('@storybook/addon-docs'),
  ],
  framework: getAbsolutePath('@storybook/react-vite'),
  // Allow arbitrary hostnames (Tailscale, LAN IPs, etc.). Storybook's manager
  // server does its own host check separate from Vite, so both layers need it.
  core: { allowedHosts: true },
  async viteFinal(sbConfig) {
    return {
      ...sbConfig,
      server: { ...sbConfig.server, allowedHosts: true as const },
    };
  },
};

export default config;
