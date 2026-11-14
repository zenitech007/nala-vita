"use client";

import { MotionConfig } from "framer-motion";
import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps, useTheme } from "next-themes";
import { useBrandTheme } from "@/hooks/useBrandTheme";

function BrandSelection() {
  const { brand, setBrand } = useBrandTheme();
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    document.documentElement.dataset.brand = brand;
    if (theme?.startsWith("theme-")) {
      setBrand(brand);
      setTheme("system");
    }
  }, [brand, setBrand, theme, setTheme]);
  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider attribute="class" themes={["light", "dark"]} storageKey="theme" defaultTheme="system" enableSystem {...props}>
      <BrandSelection />
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </NextThemesProvider>
  );
}
