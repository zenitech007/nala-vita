// Port of Amelia's lib/themes.ts. Hex values are unchanged.
export type Theme = {
  name: string;
  primary: string;
  bg: string;
  text: string;
};

export const THEMES = {
  rose:    { name: "Rose",    primary: "#FC94AF", bg: "#FFF0F3", text: "#881337" },
  fuchsia: { name: "Fuchsia", primary: "#D946EF", bg: "#FDF4FF", text: "#701A75" },
  ocean:   { name: "Ocean",   primary: "#3B82F6", bg: "#EFF6FF", text: "#1E3A8A" },
  emerald: { name: "Emerald", primary: "#10B981", bg: "#ECFDF5", text: "#064E3B" },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as readonly ThemeName[];

export const DEFAULT_THEME: ThemeName = "rose";
