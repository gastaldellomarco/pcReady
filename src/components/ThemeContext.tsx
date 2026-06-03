import { createContext } from "react";
import type { Theme } from "@/lib/theme";

/**
 *
 */
export interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);
