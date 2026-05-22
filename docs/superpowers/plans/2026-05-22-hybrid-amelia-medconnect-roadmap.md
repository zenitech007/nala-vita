# Hybrid: Amelia UI + MediConnect Skeleton — Roadmap

> **For agentic workers:** This roadmap is the index. Per-phase implementation plans are separate files in this directory, named `2026-05-22-hybrid-amelia-medconnect-phase-N-<slug>.md`. Use **superpowers:subagent-driven-development** to execute each phase plan, with review between tasks.

**Goal:** Keep MediConnect's architecture (Next.js 14, Prisma 7, Supabase, `(patient)/(doctor)/(admin)/(auth)` route groups, RBAC middleware, RLS, i18n, jest, no Python backend) and overlay Amelia's UI design (multi-theme Rose/Fuchsia/Ocean/Emerald palettes, Geist fonts, `next-themes` provider, themed sidebars, dashboards, modals, chat components). The result is a fully-wired patient-doctor platform that *looks* like the original Nala Vita.

**Architecture decision:** Med connect is the chassis; Amelia is the skin. We don't pull in Amelia's `app/`, `api/`, `lib/` business logic — those are MediConnect's domain. We pull in Amelia's `components/`, `lib/themes.ts`, font config, theme provider, and CSS tokens.

**Tech Stack (pinned):** Next.js 14 (App Router), TypeScript, Tailwind CSS **3** (Med connect's pin), Prisma 7, Supabase (`@supabase/auth-helpers-nextjs`), OpenAI, jest, next-intl. **Added in this hybrid:** `next-themes` (theme switcher), `@next/font/google` Geist fonts.

---

## Source of truth

| | Path |
|---|---|
| MediConnect skeleton (current state) | `C:\Users\IKA\Nala Vita\src\` |
| Amelia design reference (gitignored) | `C:\Users\IKA\Nala Vita\.amelia-source\` |
| Med connect history bundle (recovery) | `C:\Users\IKA\Nala Vita\.archive\nalavita-frontend-amelia.bundle` |
| Codebase graph | `C:\Users\IKA\Nala Vita\graphify-out\GRAPH_REPORT.md` (re-extract after Phase 1) |
| Original spec | `C:\Users\IKA\Downloads\medapp-claude-code-prompt.md` |

---

## The tension to handle

| | Amelia | MediConnect | Resolution |
|---|---|---|---|
| Tailwind version | v4 (`@import "tailwindcss"`, `@theme inline`) | v3 (`@tailwind base/components/utilities`) | **Translate** Amelia's v4 token blocks into Tailwind 3 syntax inside `tailwind.config.ts` + `globals.css`. No upgrade. |
| Font loading | `next/font/google` (Geist Sans + Mono via CSS variables) | None | **Port verbatim** to `src/app/layout.tsx`. |
| Theme provider | `next-themes` with 4 named themes | None (system dark/light only) | **Port** + extend to 4 themes via `.theme-rose`, `.theme-fuchsia`, `.theme-ocean`, `.theme-emerald` classes. |
| Brand identity | Title "Nala Vita", PWA "Amelia", description "AI Clinical Operating System" | No PWA metadata | **Decide** in Phase 1: keep "Amelia" as PWA shortname, or use "Nala Vita" throughout? Default: drop "Amelia" string entirely so the brand is consistently "Nala Vita". User confirms at Phase 1 start. |
| Sidebar component | Amelia has chat-oriented `Sidebar.tsx` + `PatientSidebar.tsx` | MediConnect has role-scoped `AdminSidebar`, `DoctorSidebar`, `PatientSidebar` (skeletal) | **Restyle** MediConnect's sidebars using Amelia's visual structure (icons, theme tints, navigation patterns); keep MediConnect's data wiring. |
| Modal style | Amelia's `AddMedicationModal`, `SettingsModal`, `AddPatientModal`, `UploadPatientModal` | MediConnect has `components/ui/modal.tsx` primitive | **Adopt** Amelia modal layouts; rebuild on top of MediConnect's `Modal` primitive so they live in the design system. |
| Chat UI | Amelia's `ChatInput`, `ChatMessage`, `TypingIndicator` (patient↔Amelia AI) | MediConnect's `ChatWindow.tsx` (patient↔doctor) | **Port** Amelia's chat-message presentation to MediConnect's `ChatWindow`; wire to the doctor-patient `Message` model instead of Amelia memory. |
| Dashboard widgets | `HealthDashboard`, `MedicationSchedule`, `PatientIntakeChart` | Skeletal placeholder pages | **Port** the visual components, refactor their data sources to use MediConnect's hooks (`useVitals`, `useAppointments`, etc.). |
| AI-specific surface (`NurseAvatar`, `AmeliaAlert`) | Amelia branding | N/A | **Port `NurseAvatar` as `AssistantAvatar`**; **drop `AmeliaAlert`** (or rename to `Toast`/`Alert` — MediConnect already has `toast.tsx`, prefer that). |

---

## Phase plan

| # | Phase | Deliverable | Depends on | Plan file | Est. tasks |
|---|---|---|---|---|---|
| 0 | **Preflight: verify MediConnect boots** | `npm run build` succeeds at the new location; smoke-test of `/login` + RBAC redirects. If it doesn't boot, fix before any porting begins. | — | (small, no file — single verification block at top of Phase 1) | 1-2 |
| 1 | **Design foundation** | Geist fonts wired; `next-themes` provider in `layout.tsx`; 4 themes (rose/fuchsia/ocean/emerald) selectable via `themes.ts`; `globals.css` carries Amelia's token system translated to Tailwind 3; `tailwind.config.ts` knows the new design tokens. **Visible result:** the app now renders with Geist + the selected theme's colors instead of plain Arial. | Phase 0 | `…phase-1-design-foundation.md` (written now) | ~9 |
| 2 | **Layout components: sidebars + nav** | Restyle MediConnect's `AdminSidebar`, `DoctorSidebar`, `PatientSidebar` using Amelia's visual structure (icons, theme tints, collapsed/expanded states). Add the top bar/header pattern from Amelia. **Visible result:** logged-in pages match Amelia's left-rail look but route to MediConnect's `(patient)/(doctor)/(admin)/*` URLs. | Phase 1 | `…phase-2-layout.md` | ~10 |
| 3 | **Domain UI components** | Port Amelia's `HealthDashboard`, `MedicationSchedule`, `PatientIntakeChart`, `AddMedicationModal`, `SettingsModal`, `AddPatientModal`, `UploadPatientModal`, `ChatInput`, `ChatMessage`, `TypingIndicator`, `NurseAvatar` → `AssistantAvatar` into `src/components/` (organised by domain: `dashboard/`, `medications/`, `chat/`, `modals/`, `shared/`). Each component is restyled with the new theme tokens and re-wired to MediConnect's data shapes (hooks, types). | Phase 1, 2 | `…phase-3-domain-ui.md` | ~14 |
| 4 | **Apply Amelia look to MediConnect's existing pages** | Restyle the 25+ existing route pages (`(patient)/patient/*`, `(doctor)/doctor/*`, `(admin)/admin/*`, `(auth)/*`) using the new design tokens, layouts, and components. Each page keeps its data wiring; only the JSX/CSS changes. | Phase 3 | `…phase-4-page-restyle.md` | ~25 |
| 5 | **Fill remaining MediConnect spec gaps** | Add `stripe` + `@stripe/stripe-js` deps; wire `/api/payments` and `/api/payments/webhook` to real Stripe (they exist as stubs). Verify Step 26 final integration checklist end-to-end. | Phase 4 | `…phase-5-gaps.md` | ~8 |

**Total estimated tasks: ~67.** Calendar estimate: 2–3 weeks of focused solo work.

---

## What we are NOT doing (deliberately)

- **No new Amelia AI chat / memory layer.** The user's earlier "strict pivot" decision held: Amelia's medical-memory, classify-memory, Gemini Vision lab parsing, and patient↔Amelia chat are gone. The new chat is patient↔human-doctor (MediConnect's Step 14).
- **No Python backend.** `nalavita-backend/` is deleted. All server logic lives in `src/app/api/`.
- **No Tailwind 4 upgrade.** Stay on v3 to match MediConnect's pin. Translate v4 tokens to v3 config.
- **No design changes beyond porting.** Amelia's visual language is the target. We are not "blending" or "improving" — we are reproducing.

---

## Open questions for the user (must answer before Phase 1)

1. **Brand identity:** keep "Amelia" as PWA short-name + assistant avatar name, or rebrand fully to "Nala Vita"? Default: rebrand fully.
2. **Default theme:** Amelia ships with 4 themes (rose/fuchsia/ocean/emerald). Which is the default for new users? Default: `rose` (matches "Nala Vita" feminine-healthcare positioning).
3. **Dark mode:** Amelia uses `next-themes` system mode. MediConnect's globals.css already has a `prefers-color-scheme: dark` block. Keep both (system follows OS; 4 themes are *color schemes* layered on top), or restrict to one mode? Default: keep both — themes are color palettes, light/dark is brightness.
4. **`AmeliaAlert` component:** delete (use existing `Toast`/`Alert`) or port as a renamed component? Default: delete; use MediConnect's `toast.tsx`.
5. **PWA icons + manifest.ts:** Amelia ships a `manifest.ts`. Do we want PWA install support? Default: yes, port it.

If any answer differs from defaults, update the Phase 1 plan file before executing.

---

## How to use this roadmap

1. **Now:** Confirm or amend the 5 open questions above.
2. **Phase 0:** Run the preflight verification (one Bash call — see Phase 1 plan, Task 0).
3. **Phase 1 plan is ready.** Execute via `superpowers:subagent-driven-development`.
4. **Before each subsequent phase:** ask the planner to write the next phase plan, with the current repo state as context.
5. **After each phase:** `graphify update "C:\Users\IKA\Nala Vita"` to refresh the graph; spot-check the new components in the dev server.
