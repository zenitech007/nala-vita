"use client";

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";

/**
 * Wraps next-themes with our 4 named themes (rose/fuchsia/ocean/emerald) plus
 * system light/dark. Applies the theme as a className on <html>.
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      themes={["theme-rose", "theme-fuchsia", "theme-ocean", "theme-emerald", "light", "dark", "system"]}
      defaultTheme="theme-rose"
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
