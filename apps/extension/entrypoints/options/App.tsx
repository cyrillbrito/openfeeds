import { initTheme, setTheme, type Theme } from '@/utils/theme';
import { DEFAULT_API_URL, type StorageData } from '@/utils/types';
import { createSignal, onMount, Show } from 'solid-js';
import './App.css';

export function App() {
  const [apiUrl, setApiUrl] = createSignal(DEFAULT_API_URL);
  const [theme, setThemeSignal] = createSignal<Theme>('system');
  const [showToast, setShowToast] = createSignal(false);

  onMount(async () => {
    const currentTheme = await initTheme();
    setThemeSignal(currentTheme);

    const result = (await browser.storage.local.get('apiUrl')) as StorageData;
    if (result.apiUrl) {
      setApiUrl(result.apiUrl);
    }
  });

  async function handleThemeChange(newTheme: Theme) {
    setThemeSignal(newTheme);
    await setTheme(newTheme);
  }

  async function handleBlur() {
    await browser.storage.local.set({ apiUrl: apiUrl() });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }

  function handleReset() {
    setApiUrl(DEFAULT_API_URL);
    handleBlur();
  }

  return (
    <div class="bg-base-100 min-h-screen p-8">
      <div class="mx-auto max-w-md">
        <h1 class="mb-6 text-2xl font-bold">OpenFeeds Settings</h1>

        <div class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text">OpenFeeds Server URL</span>
            </label>
            <input
              type="url"
              value={apiUrl()}
              onInput={(e) => setApiUrl(e.currentTarget.value)}
              onBlur={handleBlur}
              placeholder="https://openfeeds.app"
              class="input input-bordered w-full"
            />
            <label class="label">
              <span class="label-text-alt text-base-content/60">
                For self-hosted instances, enter your server URL
              </span>
            </label>
          </div>

          <button type="button" class="btn btn-ghost btn-sm" onClick={handleReset}>
            Reset to Default
          </button>

          <div class="divider" />

          <div class="form-control">
            <label class="label">
              <span class="label-text">Theme</span>
            </label>
            <select
              class="select select-bordered w-full"
              value={theme()}
              onChange={(e) => handleThemeChange(e.currentTarget.value as Theme)}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </div>

      <Show when={showToast()}>
        <div class="toast toast-end">
          <div class="alert alert-success">
            <span>Saved</span>
          </div>
        </div>
      </Show>
    </div>
  );
}
