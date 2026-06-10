# Hybrid Phase 4: Page Restyle

> **For agentic workers:** REQUIRED SUB-SKILL: Use **superpowers:subagent-driven-development**. Each task = one commit.

**Goal:** Apply the Amelia visual identity (Phase 1 design tokens, Phase 2 sidebars, Phase 3 domain UI) to every existing route page. Replace hardcoded `blue-*` Tailwind classes that represent primary brand colour with `var(--primary)`-backed equivalents so pages live-tint with the theme. Compose Phase 3 domain components (HealthDashboard, PatientIntakeChart, ChatMessage, etc.) into the high-traffic patient & doctor surfaces.

**Architecture:** Two passes per area —
1. **Build pass:** create 4 shared UI building blocks (`PageHeader`, `MetricCard`, `EmptyState`, `SectionCard`) once. Every page uses them.
2. **Restyle pass:** convert `bg-blue-600` → `bg-[var(--primary)]`, `from-blue-50 via-white to-cyan-50` → `from-[var(--bg-tint)] via-white to-white`, etc. Compose domain components where the page is a natural host.

**Working directory:** `C:\Users\IKA\Nala Vita\`. Branch: `hybrid-phase-4-page-restyle` (off `hybrid-phase-3-complete`).

---

## Scope

**49 files** contain `bg-blue-*` / `text-blue-*` / `border-blue-*` classes today. About 2/3 are primary-brand uses (CTAs, active states, brand chrome) that should become `var(--primary)`. The other 1/3 are *informational* blue accents (tip cards, links, secondary surfaces) — those **stay blue**.

| Category | Files in scope | Restyle approach |
|---|---|---|
| Auth (login, register) | 2 | Manual — CTA buttons → primary, gradient → bg-tint |
| Patient dashboard | 2 (page + client) | Compose HealthDashboard + PatientIntakeChart + MetricCards |
| Patient medications | 1-2 | Compose MedicationSchedule + AddMedicationModal |
| Patient chat | 2 (page + [id]) | Compose ChatMessage + ChatInput + TypingIndicator |
| Patient vitals | 1 | Manual restyle + use recharts theme bridge |
| Doctor dashboard | 2 | MetricCards + queue list restyle |
| Doctor consultation | 1 | Compose VideoCallPanel restyle |
| Remaining patient pages (8) | 8 | Mechanical sweep: blue → primary, gray-50 → tint where appropriate |
| Remaining doctor pages (9) | 9 | Same |
| Admin pages (5) | 5 | Same |

---

## Pre-flight

- `hybrid-phase-3-complete` tag exists.
- 64 tests pass on Phase 3 tip.
- All Phase 3 components (HealthDashboard, MedicationSchedule, AddMedicationModal, ChatMessage, ChatInput, TypingIndicator, PatientIntakeChart) are at `src/components/{dashboard,medications,chat}/`.

---

## Universal restyle rules

These apply across every page restyle task. Read them before starting any task.

### Rule 1 — Brand-primary blues become primary token

| Original class | Replace with |
|---|---|
| `bg-blue-600` (CTA button bg) | `bg-[var(--primary)]` |
| `bg-blue-700` (CTA hover) | drop — use `hover:opacity-90` |
| `hover:bg-blue-700` | `hover:opacity-90` |
| `text-blue-600` (active nav, brand text) | `text-[var(--primary)]` |
| `text-blue-700` (active item, deeper accent) | `text-[var(--primary)]` |
| `border-blue-500` / `border-blue-600` (active border) | `border-[var(--primary)]` |
| `bg-blue-50` (CTA tint background) — ONLY when used as primary-brand tint | `bg-[var(--primary)]/10` |
| `focus:ring-blue-500` | `focus:ring-[var(--primary)]` |
| `from-blue-50` (page gradient start) | `from-[var(--bg-tint)]` |
| `via-white to-cyan-50` (page gradient mid/end) | drop the cyan, keep `via-white to-white` |
| `shadow-blue-200` (CTA shadow) | `shadow-[var(--primary)]/30` |

### Rule 2 — Informational blues STAY blue

If you see a card whose semantic role is "info", "tip", or "warning" — keep the blue. Examples:
- `bg-blue-50 border-blue-200 text-blue-800` on an `<Info>` icon tip card → leave alone
- Telemedicine status badges that mean "info" — leave alone
- Patient demographics/insurance card accents → leave alone

If unsure, ask: *is this colour communicating "primary brand action" or "informational metadata"?*

### Rule 3 — Compose Phase 3 components where they fit

| Page | Compose |
|---|---|
| Patient dashboard | `HealthDashboard` (daily vitals widget) + `PatientIntakeChart` (intake metrics) + `MetricCard` ×4 |
| Patient medications | `MedicationSchedule` (active prescriptions list) + `AddMedicationModal` (add button → modal) |
| Patient chat/[id] | `ChatMessage` (message bubbles) + `ChatInput` (compose box) + `TypingIndicator` (when doctor typing) |
| Doctor chat/[id] | Same as patient chat — same components, just mirrored alignment via `isMine` |
| Doctor analytics | `PatientIntakeChart` (already a chart widget) where applicable |

### Rule 4 — Existing data wiring stays

Pages keep their server-side data fetching, Prisma queries, hooks, route guards, and props. Only JSX/CSS changes. **Do not refactor data flow.**

### Rule 5 — Tests aren't required for page-level restyle

These are visual changes against existing data shapes. Phase 3 components are already tested. Page-level tests would just re-test layout, which has low value. Skip tests for these tasks unless a task explicitly says otherwise.

---

## Tasks

### Task 0: Branch + baseline

- [ ] Branch:
```bash
cd "/c/Users/IKA/Nala Vita"
git checkout -b hybrid-phase-4-page-restyle hybrid-phase-3-complete
git tag hybrid-phase-4-start
```

- [ ] Confirm baseline:
```bash
npm test 2>&1 | tail -5  # expect 64 passed
npm run build 2>&1 | tail -10  # expect exit 0
```

---

### Task 1: Shared UI building blocks (TDD)

**Files to create:**
- `src/components/ui/PageHeader.tsx`
- `src/components/ui/MetricCard.tsx`
- `src/components/ui/EmptyState.tsx`
- `src/components/ui/SectionCard.tsx`
- One test file per: `src/__tests__/components/PageHeader.test.tsx` etc.

**`PageHeader`** — title + optional subtitle + optional action button. Used at top of every page:
```tsx
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode; // typically a primary-CTA button
  icon?: React.ReactNode;   // lucide icon
}
```
Visual: large bold title, smaller gray subtitle, action right-aligned, optional icon left of title in a `bg-[var(--primary)]/10 text-[var(--primary)]` square.

**`MetricCard`** — 4-up cards on dashboards. Number + label + optional trend + optional icon:
```tsx
interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; value: string };
  tone?: "primary" | "neutral" | "warning" | "success";
}
```
Visual: `rounded-2xl border border-gray-100 bg-white p-5 shadow-sm`, label small gray uppercase, value 2xl bold, optional tinted icon block.

**`EmptyState`** — when a list has no data:
```tsx
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
```
Visual: centered, gray icon in a tinted circle, title, description, optional CTA.

**`SectionCard`** — generic content section wrapper:
```tsx
interface SectionCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}
```
Visual: same chrome as MetricCard — `rounded-2xl border border-gray-100 bg-white p-6 shadow-sm` — optional header row with title + action.

Tests for each: render with required props, render with all optional props, click handler fires for `action`.

**Commit:**
```
feat(ui): add PageHeader, MetricCard, EmptyState, SectionCard

Shared visual primitives used across every restyled page. Each is
themed via var(--primary)/var(--bg-tint) so colour follows the
selected theme. Four jest test files cover render + click handlers.

Hybrid Phase 4 / Task 1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 2: Restyle auth pages (login + register)

**Files modified:** `src/app/(auth)/login/page.tsx`, `src/app/(auth)/register/page.tsx`

Both pages currently use a `bg-gradient-to-br from-blue-50 via-white to-cyan-50` page background and `bg-blue-600 hover:bg-blue-700` CTA buttons. Apply Rule 1:

- Page gradient → `bg-gradient-to-br from-[var(--bg-tint)] via-white to-white`
- Logo container `bg-blue-600` → `bg-[var(--primary)]`
- `border-blue-500 bg-blue-50 text-blue-700` (role-toggle active in register) → `border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]`
- Submit button `bg-blue-600 hover:bg-blue-700 shadow-blue-200` → `bg-[var(--primary)] hover:opacity-90 shadow-[var(--primary)]/30`
- Form-input `focus:ring-blue-500` → `focus:ring-[var(--primary)]`
- `text-blue-600 hover:text-blue-700` link colours → `text-[var(--primary)] hover:opacity-80`

Keep the "Doctor accounts require admin verification" amber-warning box unchanged.

Build to verify: `npm run build 2>&1 | tail -10`. Exit 0.

**Commit:**
```
refactor(auth): restyle login + register with primary theme token

Page gradient now starts from var(--bg-tint), CTAs use var(--primary),
form focus rings tint with theme. Brand identity tracks the theme
chosen in Settings → Color theme.

Hybrid Phase 4 / Task 2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 3: Restyle Patient Dashboard + compose Phase 3 components

**Files modified:**
- `src/app/(patient)/patient/dashboard/page.tsx` (server) — data wiring stays, restyle the wrapping div only if needed
- `src/app/(patient)/patient/dashboard/_components/PatientDashboardClient.tsx` — main work

The client component currently uses blue chrome for metric cards. Replace with `MetricCard` × 4 (from Task 1):
- Upcoming Appointments (number)
- Active Medications (number)
- Recent Vitals (latest reading or "No reading")
- Unread Messages (number)

Add a section below the metric grid that renders:
- `<HealthDashboard initialVitals={...} onUpdate={...} />` — daily intake widget (compose Phase 3)
- `<SectionCard title="Active Prescriptions" action={<Link href="/patient/medications">View all</Link>}><MedicationSchedule medications={...} /></SectionCard>`
- Quick action buttons row (Book Appointment / Check Symptoms / Chat with Doctor / View Records) — already exists; restyle to use `var(--primary)` for the primary one and outline for the rest.

Health alerts section: convert blue alert pills to amber/red per severity, primary remains for "neutral / info".

Build + visual check.

**Commit:**
```
refactor(patient/dashboard): compose Phase 3 components + theme tokens

Replaces blue metric cards with shared MetricCard. Embeds
HealthDashboard (daily vitals input) and MedicationSchedule
(active prescriptions). Quick-action CTAs use var(--primary).

Hybrid Phase 4 / Task 3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 4: Restyle Patient Medications + integrate AddMedicationModal

**Files:** `src/app/(patient)/patient/medications/page.tsx` (and any sibling `_components/`)

- Page header → `<PageHeader title="My Medications" subtitle="Track and manage your prescriptions" action={<button>Add Medication</button>} />`
- Active list → `<MedicationSchedule medications={...} />`
- "Add Medication" action button opens `<AddMedicationModal isOpen={...} onClose={...} onAdd={...} />`
- Wire `onAdd` to the existing `POST /api/medications` endpoint.
- Past/inactive list → `<SectionCard title="Past Prescriptions">...</SectionCard>`
- EmptyState when no medications.

Build + verify.

**Commit:**
```
refactor(patient/medications): compose MedicationSchedule + AddMedicationModal

Replaces bespoke medication list with the shared MedicationSchedule
component. "Add" button opens AddMedicationModal; submit posts to
existing /api/medications. PageHeader + SectionCard + EmptyState
provide consistent chrome.

Hybrid Phase 4 / Task 4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 5: Restyle Patient + Doctor Chat pages

**Files:**
- `src/app/(patient)/patient/chat/page.tsx` (chat list)
- `src/app/(patient)/patient/chat/[id]/page.tsx` (active conversation)
- `src/app/(doctor)/doctor/chat/[id]/page.tsx`

For the chat-list page (`chat/page.tsx`): list of conversation previews with last-message snippet + unread badge — apply `SectionCard` chrome + `var(--primary)` for unread badges.

For the active-conversation pages (`[id]`):
- Compose `<ChatMessage>` for each message in the thread (set `isMine` based on `senderId === currentUserId`)
- Show `<TypingIndicator />` when realtime indicates the other party is typing (existing `useRealtimeMessages` should already track this; if not, leave as a TODO)
- Use `<ChatInput>` as the composer at the bottom
- Header: patient/doctor name avatar + connection status

Existing data flow via `useMessages`/`useRealtimeMessages` stays.

Build + manual smoke if you can.

**Commit:**
```
refactor(chat): compose ChatMessage + ChatInput in both chat surfaces

Patient and doctor active-conversation pages now render Phase 3's
ChatMessage bubbles with isMine alignment, and ChatInput as the
composer. Realtime + send wiring unchanged. Chat-list page uses
SectionCard + primary-tinted unread badges.

Hybrid Phase 4 / Task 5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 6: Restyle Patient Vitals page

**Files:** `src/app/(patient)/patient/vitals/page.tsx`

- `PageHeader` for title
- Vital-input form (type/value/unit) restyled with primary-token CTA + focus ring
- Existing recharts line charts: pass `THEMES.rose.primary` as static stroke colour (matches Phase 3 Task 2's approach in `PatientIntakeChart`)
- Abnormal readings stay red (semantic — danger, not brand)

Build + verify.

**Commit:**
```
refactor(patient/vitals): primary-tinted form + recharts colours

Hybrid Phase 4 / Task 6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 7: Restyle Doctor Dashboard

**Files:**
- `src/app/(doctor)/doctor/dashboard/page.tsx`
- `src/app/(doctor)/doctor/dashboard/_components/DoctorDashboardClient.tsx`

- 4-up `MetricCard` row: Patients today / Pending lab reviews / Unread messages / Revenue this week (currency NGN per Paystack integration — don't show "$")
- Queue section: `SectionCard` containing the appointment list; each appointment row gets primary-tinted urgency border-left when HIGH/EMERGENCY
- Quick alerts section: amber/red for severity, not blue
- Recent prescriptions section: `SectionCard` + lightweight list

**Commit:**
```
refactor(doctor/dashboard): MetricCards + theme-tinted queue

Hybrid Phase 4 / Task 7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 8: Restyle Doctor Consultation (telemedicine)

**Files:**
- `src/app/(doctor)/doctor/consultation/[appointmentId]/page.tsx`
- `src/components/telemedicine/VideoCallPanel.tsx`

- VideoCallPanel control buttons (mute, camera, end, share): primary for active, gray for inactive
- "End Call" stays red (semantic)
- Right-side patient EHR panel: `SectionCard` sections for History / Allergies / Medications / Recent Vitals
- Voice-to-text notes textarea: primary focus ring + primary "Save to EHR" CTA

Patient telemedicine page (`(patient)/patient/telemedicine/[appointmentId]/page.tsx`) — same VideoCallPanel restyle benefits it automatically; just verify and adjust any local page chrome.

**Commit:**
```
refactor(telemedicine): primary-tinted controls + sectioned EHR panel

Hybrid Phase 4 / Task 8

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 9: Mechanical sweep — remaining patient pages

**Files (8 pages):**
- `(patient)/patient/appointments/page.tsx`
- `(patient)/patient/symptom-checker/page.tsx`
- `(patient)/patient/records/page.tsx`
- `(patient)/patient/prescriptions/page.tsx`
- `(patient)/patient/lab-results/page.tsx`
- `(patient)/patient/mental-health/page.tsx`
- `(patient)/patient/payments/page.tsx`
- `(patient)/patient/settings/page.tsx` (mostly uses `SettingsPanel` already — verify clean)

Apply Rule 1 (universal restyle) to each. Skip Rule 2 cases (info blues). Use `PageHeader` at the top of each page. Use `SectionCard` to wrap the main content area.

If any page is currently a `<div className="p-6">...</div>` placeholder, replace with `<PageHeader>` + `<EmptyState>` so it looks intentional rather than unfinished.

**Commit:**
```
refactor(patient): sweep restyle — 8 remaining patient pages

Apply Phase 4 universal rules (blue→primary token, gradient→bg-tint,
PageHeader, SectionCard) across appointments, symptom-checker,
records, prescriptions, lab-results, mental-health, payments,
settings. Info-blue accents preserved per Rule 2.

Hybrid Phase 4 / Task 9

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 10: Mechanical sweep — remaining doctor pages

**Files (9 pages, excluding ones already done in Tasks 7-8):**
- `(doctor)/doctor/appointments/page.tsx`
- `(doctor)/doctor/patients/page.tsx`
- `(doctor)/doctor/patients/[id]/page.tsx`
- `(doctor)/doctor/prescriptions/page.tsx`
- `(doctor)/doctor/lab-orders/page.tsx`
- `(doctor)/doctor/monitoring/page.tsx`
- `(doctor)/doctor/referrals/page.tsx`
- `(doctor)/doctor/billing/page.tsx`
- `(doctor)/doctor/analytics/page.tsx`
- `(doctor)/doctor/settings/page.tsx`

Same approach as Task 9.

**Commit:**
```
refactor(doctor): sweep restyle — remaining doctor pages

Hybrid Phase 4 / Task 10

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 11: Mechanical sweep — admin pages

**Files (5 pages):**
- `(admin)/admin/dashboard/page.tsx`
- `(admin)/admin/staff/page.tsx`
- `(admin)/admin/beds/page.tsx`
- `(admin)/admin/reports/page.tsx`
- `(admin)/admin/settings/page.tsx`

Admin already has hex-`Nala Vita Medical Center` data. Apply restyle rules and use `MetricCard`/`SectionCard` where appropriate.

**Commit:**
```
refactor(admin): sweep restyle — admin pages

Hybrid Phase 4 / Task 11

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 12: End-of-phase verification + tag

- [ ] Full test suite:
```bash
cd "/c/Users/IKA/Nala Vita" && npm test 2>&1 | tail -10
```
Expected: at least 64 + ~12 (4 new shared UI tests × ~3 tests each ≈ 12) = ~76 tests. (No page-level tests added; only the Task 1 building-block tests.)

- [ ] Clean build:
```bash
rm -rf .next && npm run build 2>&1 | tail -15
```
Exit 0, no "Failed to compile".

- [ ] **Visual smoke** — dev server + manual page tour:
```bash
npm run dev 2>&1 &
sleep 12
```
In a browser (with a test account):
- `/login` and `/register` — rose tint background, primary-coloured CTAs, no blue gradients
- `/patient/dashboard` — HealthDashboard widget visible, MedicationSchedule embedded, theme-tinted MetricCards
- `/patient/medications` — MedicationSchedule list, "Add Medication" opens AddMedicationModal
- `/patient/chat/[doctorId]` — ChatMessage bubbles, ChatInput composer, real-time updates
- `/doctor/dashboard` — queue list with primary-tinted urgency, MetricCards
- `/admin/dashboard` — same MetricCard pattern
- Switch theme to Ocean via `/patient/settings` → page chrome retints across these surfaces

```bash
cmd.exe //c "taskkill /F /IM node.exe" 2>&1 | tail -3
```

- [ ] Refresh graph:
```bash
graphify update "C:\Users\IKA\Nala Vita" 2>&1 | tail -5
```

- [ ] Tag:
```bash
git tag hybrid-phase-4-complete
git log --oneline hybrid-phase-4-complete ^hybrid-phase-4-start
```
Expected: 11-12 commits.

---

## Self-review

**Spec coverage (Step 26 final integration checklist):** Phase 4 lands the visual side of the user-facing flows. After Phase 4:
- Patient + Doctor + Admin pages all carry the Amelia visual identity tinted by the active theme
- Step 26 items "Patient can register, log in, book appointment, …" become visually presentable
- The remaining gaps in Step 26 are *runtime* gaps (DB connected, sign-up actually works end-to-end, etc.) — those are not Phase 4's job

**Out of scope for Phase 4:**
- Migrating Paystack → Stripe (deferred per user decision)
- Live-tinting recharts colours via ThemeContext (deferred to future polish phase)
- Building the missing `(patient)/pharmacy/page.tsx` (deferred per user decision)
- Page-level integration tests (Phase 3 component tests cover behavior; visual diffs would need a snapshot tool not currently set up)

**Failure modes to watch:**

- **`var(--primary)/10` opacity syntax**: Tailwind 3 accepts but the JIT cache can be stale. Always do a clean `rm -rf .next && npm run build` after restyle tasks.
- **CSS-in-JS arbitrary values not picking up the variable**: if Tailwind doesn't seem to apply `bg-[var(--primary)]` to an element, the element may be inside a portal or shadow-DOM context; check that the page actually uses the global stylesheet.
- **Phase 3 component prop mismatches**: when composing into pages, the data the page has might not exactly match the component's prop interface (e.g., MedicationSchedule expects `{name, dosage, frequency, instructions?}` but the page might have richer fields). Adapt at the call site (`<MedicationSchedule medications={meds.map(m => ({name: m.name, dosage: m.dosage, frequency: m.frequency, instructions: m.instructions}))} />`).
- **Restyle conflicts with custom inline styles**: some pages set `style={{ backgroundColor: '#...' }}` — these override Tailwind. Convert to className.

---

## Execution handoff

Plan saved. Subagent-driven execution per Phases 1-3 pattern:
- **Task 1** (shared UI building blocks) — needs full subagent + 2-stage review (real code with tests)
- **Tasks 2-8** (per-page restyles) — each is a focused page-by-page subagent dispatch
- **Tasks 9-11** (mechanical sweeps) — batched subagent per group
- **Task 12** — controller (inline) verification + tag

Approach matches Phase 1+2+3. Expected execution time per task: 2-15 min depending on page complexity. Phase 4 total: 11-12 commits.
