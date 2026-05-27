/**
 * Shared theme utility — single source of truth for dark/light mode.
 *
 * All pages (Landing, /app, /pro) read from and write to this module
 * so the theme is consistent across navigation.
 *
 * Storage key: 'racephysix_theme'  →  'dark' | 'light'
 * Fallback: prefers-color-scheme media query, then dark.
 */

const THEME_KEY = 'racephysix_theme';

export function getStoredTheme(): boolean {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored !== null) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true; // default dark
  }
}

export function setStoredTheme(dark: boolean): void {
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    // localStorage unavailable (private browsing, etc.) — still apply to DOM
  }
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}
