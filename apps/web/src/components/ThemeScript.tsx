/**
 * Blocking inline script that prevents theme flash on page load.
 *
 * Runs synchronously before first paint to set the correct DaisyUI
 * data-theme attribute on <html>. Reads the user's theme preference
 * from localStorage and resolves "system" via matchMedia.
 *
 * Based on the pattern used by next-themes (https://github.com/pacocoursey/next-themes).
 * Uses a raw <script> tag because it renders in shellComponent (before router context).
 */
export function ThemeScript() {
  return (
    // eslint-disable-next-line solid/no-innerhtml
    <script
      innerHTML={`(function() {
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
    />
  );
}
