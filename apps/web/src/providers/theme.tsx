import {
  createContext,
  createEffect,
  createSignal,
  onMount,
  useContext,
  type ParentComponent,
} from 'solid-js';
import { isServer } from 'solid-js/web';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: () => ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  actualTheme: () => 'light' | 'dracula';
}

const ThemeContext = createContext<ThemeContextType>();

export const ThemeProvider: ParentComponent = (props) => {
  const [theme, setTheme] = createSignal<ThemeMode>('system');

  // Get actual theme based on mode and system preference
  const actualTheme = () => {
    const currentTheme = theme();
    if (currentTheme === 'system') {
      if (isServer) return 'light'; // Default for SSR
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dracula' : 'light';
    } else if (currentTheme === 'dark') {
      return 'dracula';
    } else {
      return 'light';
    }
  };

  // Load saved theme from localStorage (client-only)
  onMount(() => {
    const saved = localStorage.getItem('theme') as ThemeMode;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      setTheme(saved);
    }
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
