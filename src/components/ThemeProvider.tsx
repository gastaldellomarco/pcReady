import { useCallback, useEffect, useState, type ReactNode } from "react";
import { applyTheme, getStoredTheme, saveTheme, resolveTheme } from "@/lib/theme";
import { ThemeContext, type ThemeContextValue } from "./ThemeContext";
import type { Theme } from "@/lib/theme";

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  enableSystem?: boolean;
}

/**
 * Theme Provider for PCReady
 * Supports: light, dark, system modes with localStorage persistence
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Initialize from localStorage on client
    if (typeof window === "undefined") return defaultTheme;
    return getStoredTheme();
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return resolveTheme(getStoredTheme());
  });

  // Apply theme when it changes
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    saveTheme(newTheme);
    setResolvedTheme(resolveTheme(newTheme));
  }, []);

  // Initialize theme on mount (prevents hydration mismatch)
  useEffect(() => {
    const stored = getStoredTheme();
    applyTheme(stored);
    setThemeState(stored);
    setResolvedTheme(resolveTheme(stored));
  }, []);

  // Listen to system preference changes when theme is "system"
  useEffect(() => {
    if (!enableSystem || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const newResolved = resolveTheme("system");
      applyTheme("system");
      setResolvedTheme(newResolved);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, enableSystem]);

  const value: ThemeContextValue = {
    theme,
    resolvedTheme,
    setTheme,
    isDark: resolvedTheme === "dark",
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
