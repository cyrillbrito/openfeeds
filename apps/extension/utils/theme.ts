import type { StorageData } from './types';

export type Theme = 'light' | 'dark' | 'system';

async function getTheme(): Promise<Theme> {
  const result = (await browser.storage.local.get('theme')) as StorageData;
  return result.theme || 'system';
}

export async function setTheme(theme: Theme): Promise<void> {
  await browser.storage.local.set({ theme });
  applyTheme(theme);
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.setAttribute('data-theme', resolved === 'light' ? 'garden' : 'dracula');
}

export async function initTheme(): Promise<Theme> {
  const theme = await getTheme();
  applyTheme(theme);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
    const currentTheme = await getTheme();
    if (currentTheme === 'system') {
      applyTheme('system');
    }
  });

  return theme;
}
