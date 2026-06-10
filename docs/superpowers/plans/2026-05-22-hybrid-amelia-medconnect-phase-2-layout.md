# Hybrid Phase 2: Layout Components (Sidebars + Navigation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use **superpowers:subagent-driven-development** to execute task-by-task. Each task = one commit.

**Goal:** Restyle MediConnect's three role-scoped sidebars (`AdminSidebar`, `DoctorSidebar`, `PatientSidebar`) and their consuming layouts using Amelia's collapsible / animated pattern, while keeping all existing route URLs and `user` prop wiring intact. **Theme colors come from Phase 1 CSS variables** — no hardcoded hex. Doctor sidebar's missing sign-out button is added as a side effect.

**Architecture:** One shared `SidebarShell` client component owns all sidebar chrome (desktop collapsible aside, mobile slide-in overlay, hamburger toggle, bottom Settings + Sign Out). Per-role wrappers (`PatientSidebar`, `DoctorSidebar`, `AdminSidebar`) supply only the nav-item list, the brand label, the role label, and forward the `user` prop. Collapse state persists per role to `localStorage`.

**Tech Stack additions:** `framer-motion` (new dep — used for mobile slide-in animation, matches Amelia).

**Working directory:** `C:\Users\IKA\Nala Vita\`. We are continuing on branch `hybrid-phase-1-design-foundation` — **create a new branch first** (Task 0).

---

## Pre-flight

- Confirm `hybrid-phase-1-complete` tag exists (Phase 1 finished).
- Confirm `npm run build` exits 0 on the current tree (it did at the end of Phase 1).
- Branch: create `hybrid-phase-2-layout` off `hybrid-phase-1-complete`.

---

## File map

### Created
- `src/lib/nav-config.ts` — single source for all role nav-item arrays (icon, label, href)
- `src/lib/__tests__/nav-config.test.ts` — schema test (every href starts with `/{role}/`)
- `src/components/layout/SidebarShell.tsx` — the collapsible/animated chrome
- `src/__tests__/components/SidebarShell.test.tsx` — collapse toggle, active-link styling, sign-out click

### Modified
- `package.json` + `package-lock.json` — `framer-motion` added
- `src/components/layout/PatientSidebar.tsx` — becomes a thin wrapper over `SidebarShell`
- `src/components/layout/DoctorSidebar.tsx` — same; also gains Sign Out
- `src/components/layout/AdminSidebar.tsx` — same
- `src/app/(patient)/patient/layout.tsx`, `…(doctor)/doctor/layout.tsx`, `…(admin)/admin/layout.tsx` — wrapper `<div>` switches from fixed-width side rail to flex container that gives the sidebar `shrink-0`

### Untouched in this phase
- Anything under `src/app/api/`
- Prisma schema
- Middleware / RBAC
- Page-level components (those get restyled in Phase 4)

---

## Tasks

### Task 0: Create branch + verify Phase 1 baseline

- [ ] **Step 1:** Branch off Phase 1 complete tag

```bash
cd "/c/Users/IKA/Nala Vita"
git checkout -b hybrid-phase-2-layout hybrid-phase-1-complete
git tag hybrid-phase-2-start
```

- [ ] **Step 2:** Verify build + tests on the new branch

```bash
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -5
```
Expected: build exit 0; 26 tests pass.

- [ ] **Step 3:** Confirm `framer-motion` is NOT in package.json (we install it Task 1)

```bash
grep -E "framer-motion" package.json
```
Expected: empty (not yet installed).

If any of the above fail, STOP and resolve before Task 1.

---

### Task 1: Install `framer-motion`

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1:** Install

```bash
cd "/c/Users/IKA/Nala Vita"
npm install framer-motion
```

- [ ] **Step 2:** Verify

```bash
node -e "require.resolve('framer-motion'); console.log('ok')"
```
Expected: `ok`.

- [ ] **Step 3:** Commit

```bash
git add package.json package-lock.json
git commit -m "chore: install framer-motion

Used by Amelia's mobile sidebar slide-in. SidebarShell (Task 3)
consumes motion.aside + AnimatePresence.

Hybrid Phase 2 / Task 1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Define nav configs (TDD)

**Files:**
- Create: `src/lib/nav-config.ts`
- Create: `src/__tests__/lib/nav-config.test.ts`

> Three role-scoped arrays, each entry `{ icon: LucideIcon, label: string, href: string }`. Source the URLs verbatim from the existing sidebars so no link breaks.

- [ ] **Step 1:** Write the failing test

```typescript
// src/__tests__/lib/nav-config.test.ts
import { describe, it, expect } from "@jest/globals";
import { PATIENT_NAV, DOCTOR_NAV, ADMIN_NAV } from "@/lib/nav-config";

describe("nav-config", () => {
  it("PATIENT_NAV has 11 entries (matches current sidebar)", () => {
    expect(PATIENT_NAV).toHaveLength(11);
  });

  it("DOCTOR_NAV has 11 entries", () => {
    expect(DOCTOR_NAV).toHaveLength(11);
  });

  it("ADMIN_NAV has 5 entries", () => {
    expect(ADMIN_NAV).toHaveLength(5);
  });

  it("every patient href starts with /patient/", () => {
    for (const item of PATIENT_NAV) {
      expect(item.href).toMatch(/^\/patient\//);
    }
  });

  it("every doctor href starts with /doctor/", () => {
    for (const item of DOCTOR_NAV) {
      expect(item.href).toMatch(/^\/doctor\//);
    }
  });

  it("every admin href starts with /admin/", () => {
    for (const item of ADMIN_NAV) {
      expect(item.href).toMatch(/^\/admin\//);
    }
  });

  it("each entry has icon, label, href", () => {
    for (const item of [...PATIENT_NAV, ...DOCTOR_NAV, ...ADMIN_NAV]) {
      expect(item.icon).toBeDefined();
      expect(typeof item.label).toBe("string");
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.href).toBe("string");
      expect(item.href.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2:** Run — expect module-not-found

```bash
npm test -- --testPathPattern nav-config 2>&1 | tail -10
```

- [ ] **Step 3:** Implement `src/lib/nav-config.ts`

```typescript
import {
  LayoutDashboard,
  Calendar,
  Pill,
  Activity,
  Stethoscope,
  FileText,
  TestTube,
  MessageSquare,
  Brain,
  CreditCard,
  Settings,
  Users,
  Video,
  FlaskConical,
  Share2,
  BarChart3,
  Bed,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  icon: LucideIcon;
  label: string;
  href: string;
};

export const PATIENT_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",       href: "/patient/dashboard" },
  { icon: Calendar,        label: "Appointments",    href: "/patient/appointments" },
  { icon: Pill,            label: "Medications",     href: "/patient/medications" },
  { icon: Activity,        label: "Vitals",          href: "/patient/vitals" },
  { icon: Stethoscope,     label: "Symptom Checker", href: "/patient/symptom-checker" },
  { icon: FileText,        label: "My Records",      href: "/patient/records" },
  { icon: TestTube,        label: "Lab Results",     href: "/patient/lab-results" },
  { icon: FileText,        label: "Prescriptions",   href: "/patient/prescriptions" },
  { icon: MessageSquare,   label: "Messages",        href: "/patient/chat" },
  { icon: Brain,           label: "Mental Health",   href: "/patient/mental-health" },
  { icon: CreditCard,      label: "Payments",        href: "/patient/payments" },
];

export const DOCTOR_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",          href: "/doctor/dashboard" },
  { icon: Calendar,        label: "Appointments",       href: "/doctor/appointments" },
  { icon: Users,           label: "My Patients",        href: "/doctor/patients" },
  { icon: Video,           label: "Consultations",      href: "/doctor/consultations" },
  { icon: FileText,        label: "Prescriptions",      href: "/doctor/prescriptions" },
  { icon: FlaskConical,    label: "Lab Orders",         href: "/doctor/lab-orders" },
  { icon: Activity,        label: "Patient Monitoring", href: "/doctor/monitoring" },
  { icon: Share2,          label: "Referrals",          href: "/doctor/referrals" },
  { icon: CreditCard,      label: "Billing",            href: "/doctor/billing" },
  { icon: BarChart3,       label: "Analytics",          href: "/doctor/analytics" },
  { icon: Settings,        label: "Settings",           href: "/doctor/settings" },
];

export const ADMIN_NAV: readonly NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",        href: "/admin/dashboard" },
  { icon: Users,           label: "Staff",            href: "/admin/staff" },
  { icon: Bed,             label: "Beds & Resources", href: "/admin/beds" },
  { icon: FileText,        label: "Reports",          href: "/admin/reports" },
  { icon: Settings,        label: "Settings",         href: "/admin/settings" },
];
```

- [ ] **Step 4:** Run — expect 7 passed

```bash
npm test -- --testPathPattern nav-config 2>&1 | tail -10
```

- [ ] **Step 5:** Commit

```bash
git add src/lib/nav-config.ts src/__tests__/lib/nav-config.test.ts
git commit -m "feat(layout): centralise per-role navigation config

Three readonly arrays (PATIENT_NAV, DOCTOR_NAV, ADMIN_NAV) replace
hardcoded nav-item arrays inside each sidebar component. SidebarShell
(Task 3) consumes these. Hrefs are byte-equal to the existing
sidebars' so no route changes.

Hybrid Phase 2 / Task 2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Build `SidebarShell` (TDD)

**Files:**
- Create: `src/components/layout/SidebarShell.tsx`
- Create: `src/__tests__/components/SidebarShell.test.tsx`

> Owns: desktop collapsible aside (72px ↔ 288px), mobile slide-in via `framer-motion`, hamburger toggle, brand header, user identity card, nav rendering with active state, Settings link, Sign Out (red).
>
> Persists `isCollapsed` to `localStorage` under a key derived from `role`.

- [ ] **Step 1:** Write the failing tests

```tsx
// src/__tests__/components/SidebarShell.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import { SidebarShell } from "@/components/layout/SidebarShell";
import { LayoutDashboard, Settings as SettingsIcon } from "lucide-react";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/patient/dashboard",
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

// Mock supabase
const signOut = jest.fn().mockResolvedValue({ error: null });
jest.mock("@/lib/supabase", () => ({
  supabase: { auth: { signOut } },
}));

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/patient/dashboard" },
  { icon: SettingsIcon, label: "Other", href: "/patient/other" },
];

beforeEach(() => {
  signOut.mockClear();
  localStorage.clear();
});

describe("SidebarShell", () => {
  it("renders one link per nav item", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /other/i })).toBeInTheDocument();
  });

  it("marks the active link based on pathname prefix", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /other/i })).not.toHaveAttribute("aria-current", "page");
  });

  it("shows the user name when provided", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={{ firstName: "Ada", lastName: "L" }} nav={NAV} />);
    expect(screen.getByText(/Ada L/)).toBeInTheDocument();
  });

  it("toggles collapse on hamburger click and persists to localStorage", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    const toggle = screen.getByRole("button", { name: /toggle sidebar/i });
    expect(localStorage.getItem("sidebar-collapsed-patient")).toBeNull();
    fireEvent.click(toggle);
    expect(localStorage.getItem("sidebar-collapsed-patient")).toBe("true");
    fireEvent.click(toggle);
    expect(localStorage.getItem("sidebar-collapsed-patient")).toBe("false");
  });

  it("calls supabase.auth.signOut on Sign Out click", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(signOut).toHaveBeenCalled();
  });

  it("renders Sign Out button in red", () => {
    render(<SidebarShell role="patient" roleLabel="Patient" user={null} nav={NAV} />);
    const signOutBtn = screen.getByRole("button", { name: /sign out/i });
    // Tailwind class assertion — Sign Out should carry text-red-* somewhere
    expect(signOutBtn.className).toMatch(/text-red-/);
  });
});
```

- [ ] **Step 2:** Run — expect module-not-found

```bash
npm test -- --testPathPattern SidebarShell 2>&1 | tail -15
```

- [ ] **Step 3:** Implement `src/components/layout/SidebarShell.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, LogOut, X, Heart, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/nav-config";

export type SidebarRole = "patient" | "doctor" | "admin";

export interface SidebarUser {
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
}

interface Props {
  role: SidebarRole;
  roleLabel: string;        // "Patient" | "Doctor" | "Admin" — shown under user name
  brand?: string;           // defaults to "Nala Vita"
  user: SidebarUser | null;
  nav: readonly NavItem[];
}

const COLLAPSED_W = "w-[72px]";
const EXPANDED_W = "w-72";
const STORAGE_KEY = (role: SidebarRole) => `sidebar-collapsed-${role}`;

export function SidebarShell({ role, roleLabel, brand = "Nala Vita", user, nav }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Hydrate collapse state from localStorage on mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(role));
    if (stored !== null) setIsCollapsed(stored === "true");
  }, [role]);

  const toggleCollapse = () => {
    setIsCollapsed((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY(role), String(next));
      return next;
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const settingsHref = `/${role}/settings`;

  function NavLink({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        title={isCollapsed ? item.label : undefined}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "flex items-center px-3 py-3 rounded-xl transition-colors text-sm",
          isCollapsed ? "justify-center" : "gap-3",
          isActive
            ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/50 font-medium"
        )}
      >
        <Icon size={20} className="shrink-0" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  return (
    <>
      {/* ─── Mobile trigger (visible on small screens only) ─── */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 p-2.5 bg-white dark:bg-[#1E1F22] border border-gray-200 dark:border-gray-800 rounded-full shadow-sm text-gray-600 dark:text-gray-300"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* ─── Desktop aside ─── */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen sticky top-0 shrink-0",
          "bg-[#f9f9f9] dark:bg-[#1E1F22] border-r border-gray-200 dark:border-gray-800",
          "transition-all duration-300 ease-in-out",
          isCollapsed ? COLLAPSED_W : EXPANDED_W
        )}
      >
        {/* Brand + hamburger */}
        <div className={cn("h-16 flex items-center shrink-0", isCollapsed ? "justify-center" : "px-4 justify-between")}>
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-[var(--primary)]" />
              <span className="font-bold text-gray-900 dark:text-white">{brand}</span>
            </div>
          )}
          <button
            onClick={toggleCollapse}
            aria-label="Toggle sidebar"
            className="p-2.5 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>

        {/* User card (only when expanded) */}
        {user && !isCollapsed && (
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 mx-3 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-semibold text-sm">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-gray-500">{roleLabel}</p>
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
          {nav.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Footer: Settings + Sign Out */}
        <div className="p-3 space-y-1 shrink-0 border-t border-gray-200 dark:border-gray-800">
          <Link
            href={settingsHref}
            title={isCollapsed ? "Settings" : undefined}
            className={cn(
              "flex items-center px-3 py-3 rounded-xl transition-colors text-sm font-medium",
              isCollapsed ? "justify-center" : "gap-3",
              pathname.startsWith(settingsHref)
                ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/50"
            )}
          >
            <SettingsIcon size={20} className="shrink-0" />
            {!isCollapsed && <span>Settings</span>}
          </Link>
          <button
            onClick={handleSignOut}
            aria-label="Sign Out"
            className={cn(
              "flex items-center w-full px-3 py-3 rounded-xl transition-colors text-sm font-medium",
              isCollapsed ? "justify-center" : "gap-3",
              "text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            )}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ─── Mobile overlay aside ─── */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-[#f9f9f9] dark:bg-[#1E1F22] shadow-2xl z-50 flex flex-col lg:hidden border-r border-gray-200 dark:border-gray-800"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-[var(--primary)]" />
                  <span className="font-bold text-gray-900 dark:text-white">{brand}</span>
                </div>
                <button
                  onClick={() => setIsMobileOpen(false)}
                  aria-label="Close menu"
                  className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-gray-500"
                >
                  <X size={18} />
                </button>
              </div>
              {user && (
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--primary)]/10 flex items-center justify-center text-[var(--primary)] font-semibold text-sm">
                      {user.firstName[0]}{user.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{roleLabel}</p>
                    </div>
                  </div>
                </div>
              )}
              <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-sm",
                      pathname === item.href || pathname.startsWith(item.href + "/")
                        ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/50 font-medium"
                    )}
                  >
                    <item.icon size={20} className="shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="p-3 space-y-1 border-t border-gray-200 dark:border-gray-800">
                <Link
                  href={settingsHref}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/50"
                >
                  <SettingsIcon size={20} />
                  <span>Settings</span>
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                >
                  <LogOut size={20} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 4:** Run — expect 6 passed

```bash
npm test -- --testPathPattern SidebarShell 2>&1 | tail -15
```

- [ ] **Step 5:** Build to confirm no TS regressions

```bash
npm run build 2>&1 | tail -10
```
Expected: exit 0. If `framer-motion` types complain, ensure Task 1 ran cleanly. If `var(--primary)` Tailwind arbitrary-value syntax warns, it's purely lint — should compile.

- [ ] **Step 6:** Commit

```bash
git add src/components/layout/SidebarShell.tsx src/__tests__/components/SidebarShell.test.tsx
git commit -m "feat(layout): add SidebarShell — Amelia-style collapsible sidebar

Shared chrome for all role sidebars. Desktop: collapsible 72px ↔ 288px
with hamburger toggle; persists per-role state to localStorage. Mobile:
slide-in overlay via framer-motion (Amelia's pattern). Active link uses
bg-[var(--primary)]/10 text-[var(--primary)] so it tints with the
selected theme. Bottom: Settings link + red Sign Out button. Tests
cover render, active marking, user display, collapse persistence,
sign-out wiring, and red Sign Out styling.

Hybrid Phase 2 / Task 3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Refactor `PatientSidebar` into a thin wrapper

**Files:** `src/components/layout/PatientSidebar.tsx` (modified)

- [ ] **Step 1:** Replace contents with:

```tsx
"use client";

import { SidebarShell, type SidebarUser } from "@/components/layout/SidebarShell";
import { PATIENT_NAV } from "@/lib/nav-config";

interface Props {
  user: SidebarUser | null;
}

export default function PatientSidebar({ user }: Props) {
  return (
    <SidebarShell
      role="patient"
      roleLabel="Patient"
      user={user}
      nav={PATIENT_NAV}
    />
  );
}
```

- [ ] **Step 2:** Build

```bash
npm run build 2>&1 | tail -10
```
Expected: exit 0.

- [ ] **Step 3:** Commit

```bash
git add src/components/layout/PatientSidebar.tsx
git commit -m "refactor(layout): PatientSidebar uses SidebarShell

Eliminates the bespoke aside markup; reads PATIENT_NAV from the
shared config. Visually identical to Amelia's pattern + tinted by
the selected theme.

Hybrid Phase 2 / Task 4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Refactor `DoctorSidebar` — same pattern, gains Sign Out

**Files:** `src/components/layout/DoctorSidebar.tsx` (modified)

- [ ] **Step 1:** Replace contents with:

```tsx
"use client";

import { SidebarShell, type SidebarUser } from "@/components/layout/SidebarShell";
import { DOCTOR_NAV } from "@/lib/nav-config";

interface Props {
  user: SidebarUser | null;
}

export default function DoctorSidebar({ user }: Props) {
  return (
    <SidebarShell
      role="doctor"
      roleLabel="Doctor"
      user={user}
      nav={DOCTOR_NAV}
    />
  );
}
```

> Note: the old `DoctorSidebar` had `user: { lastName?: string } | null` (a narrower type). `SidebarShell`'s `SidebarUser` requires `firstName` AND `lastName`. The doctor layout (`src/app/(doctor)/doctor/layout.tsx`) already selects both fields. No layout change needed.

- [ ] **Step 2:** Build

```bash
npm run build 2>&1 | tail -10
```
Expected: exit 0.

- [ ] **Step 3:** Commit

```bash
git add src/components/layout/DoctorSidebar.tsx
git commit -m "refactor(layout): DoctorSidebar uses SidebarShell + gains Sign Out

The previous DoctorSidebar had no sign-out button — fixed
incidentally by routing through SidebarShell's footer. Visually
identical to the patient sidebar.

Hybrid Phase 2 / Task 5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Refactor `AdminSidebar`

**Files:** `src/components/layout/AdminSidebar.tsx` (modified)

- [ ] **Step 1:** Replace contents with:

```tsx
"use client";

import { SidebarShell, type SidebarUser } from "@/components/layout/SidebarShell";
import { ADMIN_NAV } from "@/lib/nav-config";

interface Props {
  user: SidebarUser | null;
}

export default function AdminSidebar({ user }: Props) {
  return (
    <SidebarShell
      role="admin"
      roleLabel="Admin"
      user={user}
      nav={ADMIN_NAV}
    />
  );
}
```

- [ ] **Step 2:** Build

```bash
npm run build 2>&1 | tail -10
```

- [ ] **Step 3:** Commit

```bash
git add src/components/layout/AdminSidebar.tsx
git commit -m "refactor(layout): AdminSidebar uses SidebarShell

Hybrid Phase 2 / Task 6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: End-of-phase verification + tag

- [ ] **Step 1:** Full test suite

```bash
cd "/c/Users/IKA/Nala Vita"
npm test 2>&1 | tail -10
```
Expected: previous 26 + 7 (nav-config) + 6 (SidebarShell) = **39 tests pass**.

- [ ] **Step 2:** Full build

```bash
npm run build 2>&1 | tail -15
```
Expected: exit 0; no compile errors; same route count as Phase 1 (sidebar refactor doesn't add routes).

- [ ] **Step 3:** Manual smoke — start dev, visit each role's dashboard URL, observe sidebar

```bash
npm run dev 2>&1 &
# wait for "Ready in"
sleep 12
```

In a browser (with a logged-in test user, or after registering):
- `/patient/dashboard` — Amelia-style left rail, theme-rose tint on active link, hamburger collapses to 72px wide, user initials avatar visible
- `/doctor/dashboard` — same shell, doctor nav, sign-out button NOW PRESENT
- `/admin/dashboard` — same shell, admin nav (5 items)
- Resize browser to <1024px width — desktop aside hides; hamburger button appears top-left; clicking opens mobile slide-in
- Click ThemeSwitcher → Ocean → active link color changes from rose to ocean blue without page reload (proves CSS-variable-based tinting works)

If any of those break, stop and capture the failure mode.

```bash
cmd.exe //c "taskkill /F /IM node.exe"
```

- [ ] **Step 4:** Refresh graph

```bash
graphify update "C:\Users\IKA\Nala Vita" 2>&1 | tail -5
```

- [ ] **Step 5:** Tag

```bash
git tag hybrid-phase-2-complete
git log --oneline hybrid-phase-2-complete ^hybrid-phase-2-start
```
Expected: ~7 commits.

---

## Self-review (executor: skim before starting)

**Spec coverage:** Phase 2 plans 7 tasks covering the roadmap entry "Restyle MediConnect's `AdminSidebar`, `DoctorSidebar`, `PatientSidebar` using Amelia's visual structure (icons, theme tints, collapsed/expanded states). Add the top bar/header pattern from Amelia." The "top bar pattern" in Amelia is just the mobile hamburger + branded mobile header — both lives inside `SidebarShell`, so no separate top-bar file needed. The doctor sidebar's missing sign-out button is fixed as a deliberate side effect.

**Out of scope for Phase 2:**
- Restyling pages inside the layouts (dashboards, forms) — Phase 4
- Porting Amelia's domain components (HealthDashboard, ChatInput) — Phase 3
- Adding icon assets for PWA — separate Phase 2.5 if user wants
- i18n strings on "Settings" / "Sign Out" — Phase 9 polish

**Failure modes to watch for:**

- **`var(--primary)/10` Tailwind arbitrary-value syntax:** Tailwind 3 supports this, but the JIT compiler caches; if a class-name doesn't seem to apply, run `npm run build` (not just dev) to refresh the cache.
- **`framer-motion` and SSR:** `motion.aside` is client-only; we wrap usage in `<AnimatePresence>` and the file is `"use client"`. Should not SSR. If next produces hydration warnings about `motion.div`, confirm the parent component is marked `"use client"`.
- **localStorage on SSR:** `useEffect` is the right place to read it (only runs on client). Don't read in render or the SSR snapshot will differ from the client.
- **`aria-current="page"` strictness:** the active state matches both exact path and `path + "/"` prefix. If a page like `/patient/lab-results/123` is hit, the test that asserts `aria-current` on `/patient/lab-results` should still pass — the prefix check handles it.
- **`type LucideIcon`:** comes from `lucide-react`. If TS complains, use `import { type LucideIcon }` (already in nav-config.ts).
- **Doctor layout already selects firstName + lastName:** confirmed in this plan's Pre-flight context section. If a different layout was updated since, re-check `src/app/(doctor)/doctor/layout.tsx`'s Prisma `select`.

---

## Execution handoff

**Plan saved to `docs/superpowers/plans/2026-05-22-hybrid-amelia-medconnect-phase-2-layout.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task + 2-stage review, continuous execution.

**2. Inline Execution** — batch with checkpoints.

**Which approach?**
