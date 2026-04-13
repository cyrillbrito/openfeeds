import type { StorybookConfig } from 'storybook-solidjs-vite';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

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
  framework: getAbsolutePath('storybook-solidjs-vite'),
  async viteFinal(config) {
    const { default: storybookViteConfig } = await import('../vite.config.storybook.ts');

    // Storybook passes in the full app vite.config.ts plugins (Nitro, TanStack
    // Start, devtools...) which pull in @repo/db → bun APIs unavailable in Node.
    // Keep only Storybook's own plugins and replace everything else with our
    // minimal storybook-specific config.
    const storybookOwnPlugins = (config.plugins ?? []).flat().filter((p: any) => {
      const name: string = p?.name ?? '';
      return name.startsWith('storybook') || name.startsWith('vite:storybook') || name.startsWith('plugin-csf') || name === 'vite:react-docgen-typescript';
    });

    const { plugins: ourPlugins = [] } = storybookViteConfig as any;

    return {
      ...config,
      plugins: [...ourPlugins, ...storybookOwnPlugins],
    };
  },
};

export default config;
