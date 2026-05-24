/**
 * Blocking inline script that prevents theme flash on page load.
 *
 * The real app uses the equivalent inline `<script>` in `apps/web/index.html`
 * (which is the only way to run code before first paint in an SPA). This
 * component exists solely for Storybook, which renders its own document shell
 * and needs the same flash-prevention logic. Keep the two in sync.
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
