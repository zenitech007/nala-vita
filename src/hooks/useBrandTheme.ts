"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEME_NAMES, type ThemeName } from "@/lib/themes";

function readBrand(): ThemeName {
  try {
    const saved = localStorage.getItem("nala-brand") ?? localStorage.getItem("theme")?.replace("theme-", "");
    return THEME_NAMES.includes(saved as ThemeName) ? saved as ThemeName : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("nala-brand-change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("nala-brand-change", listener);
  };
}
function setBrand(brand: ThemeName) {
  localStorage.setItem("nala-brand", brand);
  document.documentElement.dataset.brand = brand;
  window.dispatchEvent(new Event("nala-brand-change"));
}
export function useBrandTheme() {
  const brand = useSyncExternalStore(subscribe, readBrand, () => DEFAULT_THEME);
  return { brand, setBrand };
}
