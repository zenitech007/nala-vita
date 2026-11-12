"use client";

import { useId } from "react";
import { useTheme } from "next-themes";
import { useBrandTheme } from "@/hooks/useBrandTheme";
import { THEMES, THEME_NAMES } from "@/lib/themes";

export function ThemeSwitcher() {
  const { brand, setBrand } = useBrandTheme();
  const { theme, setTheme } = useTheme();
  const brightnessId = useId();
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Color theme" className="flex flex-wrap gap-3">
        {THEME_NAMES.map(name => (
          <button key={name} type="button" aria-pressed={brand === name} aria-label={THEMES[name].name}
            title={THEMES[name].name} onClick={() => setBrand(name)}
            className={`h-10 w-10 rounded-full border-2 transition ${brand === name ? "border-foreground" : "border-transparent"}`}
            style={{ background: THEMES[name].primary }} />
        ))}
      </div>
      <div>
        <label htmlFor={brightnessId} className="mb-1 block text-sm font-medium">Brightness</label>
        <select id={brightnessId} value={theme ?? "system"} onChange={event => setTheme(event.target.value)}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
    </div>
  );
}
