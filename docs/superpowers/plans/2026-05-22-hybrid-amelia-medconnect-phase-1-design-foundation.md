# Hybrid Phase 1: Design Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use **superpowers:subagent-driven-development** (recommended) or **superpowers:executing-plans** to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Each task is one commit.

**Goal:** Land Amelia's visual identity (Geist fonts, 4-theme palette system, theme provider) on top of MediConnect's working skeleton — **without changing any business logic or routes.** At end of phase: `/login`, `/patient/dashboard`, `/doctor/dashboard`, `/admin/dashboard` all render with the new fonts + selected theme's colors. No new features; pure visual foundation.

**Architecture:** Amelia's `themes.ts` defines 4 palettes as JS objects with hex values. We translate these into CSS custom properties applied via theme classes on `<html>` (e.g., `<html class="theme-rose">`). `next-themes` toggles the class. Tailwind 3 reads the CSS variables through `tailwind.config.ts`. Fonts use `next/font/google` exactly as Amelia did.

**Tech Stack additions:** `next-themes` (new dep).

**Working directory for all commands:** `C:\Users\IKA\Nala Vita\` (the repo root — there is no longer a `nalavita-frontend/` subdir).

---

## Pre-flight: read before starting

- Confirm answers to the 5 open questions in `…roadmap.md`. Defaults are documented; if user picks non-default, adjust Tasks 5 and 9 accordingly.
- **Branch:** create `git checkout -b hybrid-phase-1-design-foundation` before Task 0.
- **Commit style:** `feat(design):`, `chore:`, `refactor:` prefixes; sign-off `Hybrid Phase 1 / Task N`.

---

## File map

### Modified
- `package.json` — add `next-themes`
- `package-lock.json` — regenerated
- `src/app/layout.tsx` — Geist fonts + `ThemeProvider` + PWA metadata + `<html className="theme-rose">`
- `src/app/globals.css` — Amelia-derived design tokens, theme classes, dark-mode override
- `tailwind.config.ts` — extend theme.colors to map to the new CSS variables
- `src/components/settings/SettingsPanel.tsx` (existing) — add theme switcher (if not already present)

### Created
- `src/lib/themes.ts` — port of Amelia's `THEMES` object (typed, 4 palettes)
- `src/lib/__tests__/themes.test.ts` — typed shape + values match Amelia
- `src/components/providers/ThemeProvider.tsx` — wraps `next-themes` with our 4 themes registered
- `src/components/ui/ThemeSwitcher.tsx` — 4-button color picker; controllable from settings
- `src/components/ui/__tests__/ThemeSwitcher.test.tsx` — interaction test
- `public/manifest.json` — PWA manifest if absent

### Untouched in this phase
- Anything under `src/app/api/`
- Anything under `prisma/`
- `src/middleware.ts`
- `src/lib/{prisma.ts,supabase*.ts,validations.ts,env.ts,rate-limit.ts,notifications.ts}` — back-end concerns

---

## Tasks

### Task 0: Preflight — verify the relocated MediConnect actually boots

> This is the gate. If `npm run build` fails on the current code, no porting starts until it's fixed.

- [ ] **Step 1: Build the project**

```bash
cd "/c/Users/IKA/Nala Vita"
npm run build 2>&1 | tail -40
```
Expected: ends with `✓ Compiled successfully` and a route listing. Acceptable: warnings, prerender errors on routes that need a DB (those are env issues, not code issues — note them and proceed).

- [ ] **Step 2: If build fails:** capture the first 2 errors. Stop. Open a new conversation with the planner — request a "MediConnect preflight repair" mini-plan before continuing. **Do not start Phase 1 implementation until build passes.**

- [ ] **Step 3: If build passes:** start the dev server briefly and confirm `/login` renders

```bash
npm run dev &
sleep 8
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3000/login
kill %1 2>/dev/null
```
Expected: `200`. If `500` or hang, treat as failure and stop (see Step 2).

- [ ] **Step 4: Commit a branch checkpoint** (no file changes, just a tag for Phase 1 starting line)

```bash
git checkout -b hybrid-phase-1-design-foundation
git tag hybrid-phase-1-start
```

---

### Task 1: Install `next-themes`

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
npm install next-themes
```

- [ ] **Step 2: Verify**

```bash
node -e "require.resolve('next-themes'); console.log('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install next-themes

Hybrid Phase 1 / Task 1"
```

---

### Task 2: Port `lib/themes.ts` (TDD)

**Files:**
- Create: `src/lib/themes.ts`
- Create: `src/lib/__tests__/themes.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/themes.test.ts
import { describe, it, expect } from "@jest/globals";
import { THEMES, THEME_NAMES, type ThemeName } from "@/lib/themes";

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
});
```

- [ ] **Step 2: Run — expect module-not-found**

```bash
npm test -- --testPathPattern themes.test.ts 2>&1 | tail -10
```

- [ ] **Step 3: Implement** — `src/lib/themes.ts`

```typescript
// Port of Amelia's lib/themes.ts. Hex values are unchanged.
export type Theme = {
  name: string;
  primary: string;
  bg: string;
  text: string;
};

export const THEMES = {
  rose:     { name: "Rose",     primary: "#FC94AF", bg: "#FFF0F3", text: "#881337" },
  fuchsia:  { name: "Fuchsia",  primary: "#D946EF", bg: "#FDF4FF", text: "#701A75" },
  ocean:    { name: "Ocean",    primary: "#3B82F6", bg: "#EFF6FF", text: "#1E3A8A" },
  emerald:  { name: "Emerald",  primary: "#10B981", bg: "#ECFDF5", text: "#064E3B" },
} as const satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES: ThemeName[] = ["rose", "fuchsia", "ocean", "emerald"];

export const DEFAULT_THEME: ThemeName = "rose"; // user-confirmed default per roadmap Q2
```

- [ ] **Step 4: Run — expect 5 passed**

```bash
npm test -- --testPathPattern themes.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/themes.ts src/lib/__tests__/themes.test.ts
git commit -m "feat(design): port Amelia's THEMES (rose/fuchsia/ocean/emerald)

Values verbatim from Amelia's lib/themes.ts. DEFAULT_THEME is 'rose'
per roadmap Q2.

Hybrid Phase 1 / Task 2"
```

---

### Task 3: Update `globals.css` — translate Amelia tokens to Tailwind 3 syntax

**Files:** `src/app/globals.css` (modified)

> Amelia uses Tailwind 4's `@theme inline` and CSS variables read directly by Tailwind 4. In Tailwind 3 we keep the CSS variables but map them via `tailwind.config.ts` (Task 4). The CSS itself sets per-theme variables on `.theme-*` classes.

- [ ] **Step 1: Replace `src/app/globals.css` with:**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/*
  Theme tokens.
  --primary / --bg-tint / --text-on-tint match Amelia's THEMES palette.
  --background / --foreground are the page chrome (light/dark mode).
*/

:root {
  /* Light mode chrome */
  --background: #ffffff;
  --foreground: #171717;

  /* Default theme = rose (overridden by .theme-* classes below) */
  --primary: #FC94AF;
  --bg-tint: #FFF0F3;
  --text-on-tint: #881337;
}

.theme-rose {
  --primary: #FC94AF;
  --bg-tint: #FFF0F3;
  --text-on-tint: #881337;
}

.theme-fuchsia {
  --primary: #D946EF;
  --bg-tint: #FDF4FF;
  --text-on-tint: #701A75;
}

.theme-ocean {
  --primary: #3B82F6;
  --bg-tint: #EFF6FF;
  --text-on-tint: #1E3A8A;
}

.theme-emerald {
  --primary: #10B981;
  --bg-tint: #ECFDF5;
  --text-on-tint: #064E3B;
}

/* Dark mode flips chrome only; theme tint stays for brand colour continuity */
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0a0a0a;
    --foreground: #ededed;
  }
}

html.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}

html.high-contrast {
  --background: #000000;
  --foreground: #ffffff;
  --primary: #FFFF00;
  --bg-tint: #000000;
  --text-on-tint: #FFFFFF;
}

html.high-contrast body {
  color: #ffffff;
  background: #000000;
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-geist-sans), Arial, Helvetica, sans-serif;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}
```

- [ ] **Step 2: Sanity check the CSS parses**

```bash
npm run build 2>&1 | grep -E "(error|warn).*globals" | head -5
```
Expected: no output (no globals.css errors). If errors, check for typos.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design): port Amelia's design tokens to globals.css

Adds .theme-rose/.theme-fuchsia/.theme-ocean/.theme-emerald classes,
each setting --primary / --bg-tint / --text-on-tint. Default :root
mirrors rose. Preserves existing dark mode + high-contrast support.

Hybrid Phase 1 / Task 3"
```

---

### Task 4: Extend `tailwind.config.ts` to read the CSS variables

**Files:** `tailwind.config.ts` (modified)

- [ ] **Step 1: Read the current config**

```bash
cat "/c/Users/IKA/Nala Vita/tailwind.config.ts"
```
Expected: a TS object with `content: [...]`, possibly an existing `theme.extend`.

- [ ] **Step 2: Add the colour mappings under `theme.extend.colors`**

Edit `tailwind.config.ts` so the export looks like:

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
        },
        tint: {
          DEFAULT: "var(--bg-tint)",
          foreground: "var(--text-on-tint)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
```

**Note:** if the existing `content` array differs (e.g., includes `./pages/`), preserve it — only add the new `extend.colors` and `extend.fontFamily`.

- [ ] **Step 3: Verify the build picks it up**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds. If `Module not found: tailwindcss/types/config` style errors appear, run `npm install` and retry.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(design): map CSS variables in tailwind.config.ts

Adds bg-{primary,tint,background,foreground} utilities backed by the
new CSS variables. Adds font-sans/font-mono pointing to Geist.

Hybrid Phase 1 / Task 4"
```

---

### Task 5: Port `next/font/google` Geist into `src/app/layout.tsx` + add `ThemeProvider`

**Files:** `src/app/layout.tsx` (modified)

> Decisions encoded here from roadmap Q1 and Q5:
> - Drop the "Amelia" PWA short-name; use "Nala Vita" throughout (roadmap default).
> - Keep PWA viewport + manifest (roadmap Q5 default).

- [ ] **Step 1: Read current layout**

```bash
cat "/c/Users/IKA/Nala Vita/src/app/layout.tsx"
```
Capture what it exports (any providers it already wraps).

- [ ] **Step 2: Create `src/components/providers/ThemeProvider.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#FC94AF", // matches default rose primary
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Nala Vita",
  description: "AI-assisted patient-doctor medical platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nala Vita",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className="theme-rose">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

> **If the previous `layout.tsx` wrapped other providers (e.g., `QueryClientProvider`, `<TooltipProvider>`, `<I18nProvider>`):** insert them INSIDE `<ThemeProvider>` so they aren't unmounted by theme toggles. Diff against the original before committing.

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -15
```
Expected: success. If `Module not found: next-themes` — Task 1 didn't install; rerun it.

- [ ] **Step 5: Smoke test in dev**

```bash
npm run dev &
sleep 8
curl -sS http://localhost:3000/login | grep -E "font-geist-sans|theme-rose" | head -3
kill %1 2>/dev/null
```
Expected output: at least one line containing `theme-rose` and/or `font-geist-sans` (proves the class is on `<html>` and the font variable is on `<body>`).

- [ ] **Step 6: Commit**

```bash
git add src/components/providers/ThemeProvider.tsx src/app/layout.tsx
git commit -m "feat(design): wire Geist fonts + next-themes provider

Roots html in theme-rose by default. Themes = rose/fuchsia/ocean/
emerald + system light/dark. PWA metadata says 'Nala Vita'
throughout (no 'Amelia' branding per roadmap Q1).

Hybrid Phase 1 / Task 5"
```

---

### Task 6: Build the ThemeSwitcher component (TDD)

**Files:**
- Create: `src/components/ui/ThemeSwitcher.tsx`
- Create: `src/components/ui/__tests__/ThemeSwitcher.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/__tests__/ThemeSwitcher.test.tsx
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

// Mock next-themes
const setTheme = jest.fn();
jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "theme-rose", setTheme }),
}));

describe("ThemeSwitcher", () => {
  it("renders one button per theme", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("button", { name: /rose/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fuchsia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ocean/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /emerald/i })).toBeInTheDocument();
  });

  it("marks the active theme with aria-pressed=true", () => {
    render(<ThemeSwitcher />);
    expect(screen.getByRole("button", { name: /rose/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /ocean/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls setTheme on click", () => {
    render(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /ocean/i }));
    expect(setTheme).toHaveBeenCalledWith("theme-ocean");
  });
});
```

- [ ] **Step 2: Run — expect module-not-found**

```bash
npm test -- --testPathPattern ThemeSwitcher.test.tsx 2>&1 | tail -10
```

- [ ] **Step 3: Implement** — `src/components/ui/ThemeSwitcher.tsx`

```tsx
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
```

- [ ] **Step 4: Run — expect 3 passed**

```bash
npm test -- --testPathPattern ThemeSwitcher.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ThemeSwitcher.tsx src/components/ui/__tests__/ThemeSwitcher.test.tsx
git commit -m "feat(design): add ThemeSwitcher (4-button color picker)

Hybrid Phase 1 / Task 6"
```

---

### Task 7: Wire ThemeSwitcher into the existing Settings page(s)

**Files:**
- Modify: `src/components/settings/SettingsPanel.tsx` (existing)
- Modify (if exists): `src/app/(patient)/patient/settings/page.tsx`, `src/app/(doctor)/doctor/settings/page.tsx`, `src/app/(admin)/admin/settings/page.tsx`

- [ ] **Step 1: Read the existing settings panel**

```bash
cat "/c/Users/IKA/Nala Vita/src/components/settings/SettingsPanel.tsx"
```
Capture what sections it already has (so we slot the switcher in without breaking layout).

- [ ] **Step 2: Insert a "Color theme" section**

Add into `SettingsPanel.tsx` (location: top of the panel, above the first existing section — themes are visual identity so they belong first):

```tsx
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";

// ... existing imports

// Inside the component's JSX, near the top:
<section className="space-y-2">
  <h3 className="text-sm font-medium text-foreground">Color theme</h3>
  <p className="text-xs text-muted-foreground">Pick the palette that feels best.</p>
  <ThemeSwitcher />
</section>
```

- [ ] **Step 3: Confirm settings pages render the panel** (probably already do — verify)

```bash
grep -nr "SettingsPanel" "/c/Users/IKA/Nala Vita/src/app/" | head -5
```
If any settings page imports `SettingsPanel`, it inherits the switcher automatically.

- [ ] **Step 4: Smoke test**

```bash
npm run build 2>&1 | tail -10
```
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/SettingsPanel.tsx
git commit -m "feat(design): add ThemeSwitcher section to SettingsPanel

Hybrid Phase 1 / Task 7"
```

---

### Task 8: PWA manifest

**Files:**
- Create or verify: `public/manifest.json`
- Modify (if absent): `src/app/layout.tsx` (link tag)

- [ ] **Step 1: Check if manifest exists**

```bash
ls "/c/Users/IKA/Nala Vita/public/manifest.json" 2>&1
ls "/c/Users/IKA/Nala Vita/src/app/manifest.ts" 2>&1
```
If either exists, skim it and skip to Step 3.

- [ ] **Step 2: If absent, create `public/manifest.json`**

```json
{
  "name": "Nala Vita",
  "short_name": "Nala Vita",
  "description": "AI-assisted patient-doctor medical platform",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF0F3",
  "theme_color": "#FC94AF",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

> **Icons:** if `/icon-192.png` and `/icon-512.png` don't exist, the manifest still works (browsers fall back to favicon). Adding actual icons is a Phase-2 design asset task; not blocking here.

- [ ] **Step 3: Reference the manifest from `layout.tsx`** (only needed for `public/manifest.json`; not needed if `src/app/manifest.ts` exists — Next auto-discovers)

Add into `metadata` export in `src/app/layout.tsx`:

```typescript
export const metadata: Metadata = {
  title: "Nala Vita",
  description: "AI-assisted patient-doctor medical platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Nala Vita",
  },
};
```

- [ ] **Step 4: Build + commit**

```bash
npm run build 2>&1 | tail -5
git add public/manifest.json src/app/layout.tsx
git commit -m "feat(design): add PWA manifest

Hybrid Phase 1 / Task 8"
```

---

### Task 9: End-of-phase verification + tag

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite**

```bash
npm test 2>&1 | tail -20
```
Expected: all green. Roughly: existing tests + 5 themes + 3 ThemeSwitcher = whatever the baseline was + 8 new.

- [ ] **Step 2: Full build**

```bash
npm run build 2>&1 | tail -20
```
Expected: success, no new warnings.

- [ ] **Step 3: Manual smoke**

```bash
npm run dev &
sleep 8
```
In a browser, visit each of:
- `http://localhost:3000/login` — Geist font visible, rose-pink background tint subtle, no console errors
- `http://localhost:3000/patient/dashboard` — RBAC redirects to `/login` (still expected since no auth)
- `http://localhost:3000/doctor/dashboard` — RBAC redirects to `/login`
- (If a settings route is publicly viewable in dev mode) — click ThemeSwitcher; `<html>` class changes; colors update

```bash
kill %1 2>/dev/null
```

- [ ] **Step 4: Refresh the knowledge graph**

```bash
graphify update "C:\Users\IKA\Nala Vita" 2>&1 | tail -5
```

- [ ] **Step 5: Tag the phase**

```bash
git tag hybrid-phase-1-complete
git log --oneline hybrid-phase-1-complete ^hybrid-phase-1-start
```
Expected: 8-9 commits (Tasks 1-8 each).

- [ ] **Step 6: Push** (optional)

```bash
git push -u origin hybrid-phase-1-design-foundation
```

- [ ] **Step 7: Request Phase 2 plan**

In the next session, ask the planner: "Write Hybrid Phase 2 (Layout components) plan." Provide the `hybrid-phase-1-complete` tag as the starting point.

---

## Self-review (executor: skim before starting)

**Spec coverage in Phase 1:** Foundation only — visual identity, fonts, theme provider, theme switcher, PWA manifest. No business-logic changes. Steps from the original MediConnect spec (auth, appointments, payments, etc.) are not touched here — they remain functional as Med connect built them, just visually reskinned.

**Out of scope for this phase (do NOT do here):**
- Restyling specific MediConnect pages (login form, dashboards, etc.) — Phase 4
- Porting Amelia's domain components (HealthDashboard, MedicationSchedule, modals) — Phase 3
- Restyling sidebars (AdminSidebar, DoctorSidebar, PatientSidebar) — Phase 2
- Adding Stripe — Phase 5
- Adding icons for the PWA manifest — Phase 2 asset task

**Failure modes to watch for:**
- `next/font/google` fails to download in restricted networks → check `next.config.mjs` for any `outputFileTracingExcludes` blocking it; ensure outbound HTTPS works.
- `next-themes` v0.x flicker on first paint → confirm `suppressHydrationWarning` is on `<html>` (it is in Task 5).
- Tailwind 3 not picking up `var(--primary)` → verify Task 4's `tailwind.config.ts` is exporting (TS or JS — must match Med connect's existing config style).
- Theme class on `<html>` resets on route change → won't happen with `next-themes` `attribute="class"` mode, but if it does check that `ThemeProvider` is mounted in the root layout (Task 5).

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-22-hybrid-amelia-medconnect-phase-1-design-foundation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. Use **superpowers:subagent-driven-development**.

**2. Inline Execution** — execute tasks in this session using **superpowers:executing-plans**, batch checkpoints for review.

**Which approach?**
