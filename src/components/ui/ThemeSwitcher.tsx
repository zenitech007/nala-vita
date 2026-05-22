"use client";

import { useTheme } from "next-themes";
import { THEMES, THEME_NAMES, type ThemeName } from "@/lib/themes";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div role="group" aria-label="Color theme" className="flex gap-2">
      {THEME_NAMES.map((name) => {
        const meta = THEMES[name];
        const className = `theme-${name}` as const;
        const active = theme === className;
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            aria-label={meta.name}
            title={meta.name}
            onClick={() => setTheme(className)}
            className={`h-8 w-8 rounded-full border-2 transition ${active ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ background: meta.primary }}
          />
        );
      })}
    </div>
  );
}
