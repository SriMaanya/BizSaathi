export const THEME_KEY = 'bizsaathi_theme';

export function getSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(themeChoice) {
  const effectiveTheme = themeChoice === 'system' ? getSystemTheme() : (themeChoice || 'light');
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-theme-choice', themeChoice || 'light');
  }
  try {
    localStorage.setItem(THEME_KEY, themeChoice || 'light');
  } catch (err) {
    console.error('Failed to save theme in localStorage:', err);
  }
  return effectiveTheme;
}
