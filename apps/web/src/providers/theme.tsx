import {
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
  useContext,
  type ParentComponent,
} from 'solid-js';
import { isServer } from 'solid-js/web';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: () => ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  actualTheme: () => 'garden' | 'dracula';
}

const ThemeContext = createContext<ThemeContextType>();

export const ThemeProvider: ParentComponent = (props) => {
  const [theme, setTheme] = createSignal<ThemeMode>('system');

  // Track system preference reactively so "system" mode updates live
  const [systemPrefersDark, setSystemPrefersDark] = createSignal(false);

  // Get actual theme based on mode and system preference
  const actualTheme = () => {
    const currentTheme = theme();
    if (currentTheme === 'system') {
      if (isServer) return 'garden' as const; // Default for SSR
      return systemPrefersDark() ? ('dracula' as const) : ('garden' as const);
    } else if (currentTheme === 'dark') {
      return 'dracula' as const;
    } else {
      return 'garden' as const;
    }
  };

  // Load saved theme from localStorage (client-only)
  onMount(() => {
    const saved = localStorage.getItem('theme') as ThemeMode;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      setTheme(saved);
    }

    // Listen for system theme preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    onCleanup(() => mediaQuery.removeEventListener('change', handler));
  });

  // Apply theme to document
  createEffect(() => {
    if (isServer) return;
    const themeToApply = actualTheme();
    document.documentElement.setAttribute('data-theme', themeToApply);
    localStorage.setItem('theme', theme());
  });

  const value: ThemeContextType = {
    theme,
    setTheme,
    actualTheme,
  };

  return <ThemeContext.Provider value={value}>{props.children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
