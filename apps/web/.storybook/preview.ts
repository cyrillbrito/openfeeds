/// <reference types="vite/client" />
import '../src/styles/tokens.css';
import type { Preview } from 'storybook-solidjs-vite';

// DaisyUI themes set `background` on :root via --root-bg. Override it so
// Storybook's own background controls work and the canvas stays neutral.
if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--root-bg', 'transparent');
  document.documentElement.style.setProperty('--page-scroll-bg', 'transparent');
}

const preview: Preview = {
  parameters: {
    actions: {
      // Auto-log any prop matching on* (onClick, onClose, etc.) to the Actions panel.
      // Note: these are NOT spies — for play function assertions, use explicit fn().
      argTypesRegex: '^on[A-Z].*',
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
};

export default preview;
