import { ScriptOnce } from '@tanstack/solid-router';

/**
 * Blocking inline script that prevents theme flash on page load.
 *
 * Runs synchronously before first paint to set the correct DaisyUI
 * data-theme attribute on <html>. Reads the user's theme preference
 * from localStorage and resolves "system" via matchMedia.
 *
 * Based on the pattern used by next-themes (https://github.com/pacocoursey/next-themes).
 * Must stay as a string — ScriptOnce injects it as raw JS in <head>.
 */
export function ThemeScript() {
  return (
    <ScriptOnce>
      {`(function() {
        try {
          var theme = localStorage.getItem('theme') || 'system';
          var resolved = theme;
          if (theme === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          var daisyTheme = resolved === 'dark' ? 'dracula' : 'garden';
          document.documentElement.setAttribute('data-theme', daisyTheme);
        } catch (e) {
          document.documentElement.setAttribute('data-theme', 'garden');
        }
      })()`}
    </ScriptOnce>
  );
}
