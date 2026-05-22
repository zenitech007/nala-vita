import { describe, it, expect } from "@jest/globals";
import { THEMES, THEME_NAMES, DEFAULT_THEME, type ThemeName } from "@/lib/themes";

describe("THEMES", () => {
  it("exports exactly 4 themes", () => {
    expect(Object.keys(THEMES)).toHaveLength(4);
  });

  it("includes rose / fuchsia / ocean / emerald", () => {
    expect(THEMES).toHaveProperty("rose");
    expect(THEMES).toHaveProperty("fuchsia");
    expect(THEMES).toHaveProperty("ocean");
    expect(THEMES).toHaveProperty("emerald");
  });

  it("each theme has name, primary, bg, text", () => {
    for (const key of Object.keys(THEMES)) {
      const t = THEMES[key as ThemeName];
      expect(t.name).toBeTruthy();
      expect(t.primary).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.bg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.text).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("preserves Amelia's rose primary colour", () => {
    expect(THEMES.rose.primary).toBe("#FC94AF");
  });

  it("THEME_NAMES is the keys array", () => {
    expect(THEME_NAMES).toEqual(["rose", "fuchsia", "ocean", "emerald"]);
  });

  it("DEFAULT_THEME is rose", () => {
    expect(DEFAULT_THEME).toBe("rose");
  });
});
