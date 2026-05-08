const KEY = "pcready-theme";

export type Theme = "light" | "dark" | "system";

/**
 * Check if system prefers dark mode
 */
function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Resolve effective theme (light/dark) from stored theme value
 */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return systemPrefersDark() ? "dark" : "light";
  }
  return theme;
}

/**
 * Get stored theme from localStorage
 */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(KEY) as Theme | null;
  return stored ?? "system";
}

/**
 * Apply theme to document (adds/removes 'dark' class)
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  const isDark = resolveTheme(theme) === "dark";
  document.documentElement.classList.toggle("dark", isDark);
}

/**
 * Save theme preference to localStorage
 */
export function saveTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, theme);
}

/**
 * Legacy: Initialize theme from localStorage (used on app start)
 * @deprecated Use ThemeProvider instead
 */
export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}

/**
 * Legacy: Check if current theme is dark
 * @deprecated Use useTheme hook instead
 */
export function isDark(): boolean {
  if (typeof window === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

/**
 * Legacy: Toggle between light and dark
 * @deprecated Use setTheme from useTheme hook instead
 */
export function toggleTheme() {
  const current = getStoredTheme();
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  saveTheme(next);
}
