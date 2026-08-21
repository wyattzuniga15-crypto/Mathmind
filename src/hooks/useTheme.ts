'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadSettings, saveSettings } from '@/lib/client/storage';

export type Theme = 'light' | 'dark' | 'system';

function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    const stored = loadSettings().theme;
    setThemeState(stored);
    apply(stored);
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => apply('system');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    apply(next);
    saveSettings({ ...loadSettings(), theme: next });
  }, []);

  const toggle = useCallback(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  }, [setTheme]);

  return { theme, setTheme, toggle };
}
