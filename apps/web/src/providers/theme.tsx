import { createContext, use, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  actualTheme: 'garden' | 'dracula';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>('system');
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  const actualTheme = useMemo<'garden' | 'dracula'>(() => {
    if (theme === 'system') return systemPrefersDark ? 'dracula' : 'garden';
    if (theme === 'dark') return 'dracula';
    return 'garden';
  }, [theme, systemPrefersDark]);

  useEffect(() => {
    const saved = localStorage.getItem('theme') as ThemeMode;
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      setTheme(saved);
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemPrefersDark(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', actualTheme);
    localStorage.setItem('theme', theme);
  }, [actualTheme, theme]);

  const value = useMemo<ThemeContextType>(
    () => ({ theme, setTheme, actualTheme }),
    [theme, setTheme, actualTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
