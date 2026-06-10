# Hybrid Phase 3: Domain UI Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use **superpowers:subagent-driven-development** to execute task-by-task. Each task = one commit.

**Goal:** Port 7 of Amelia's domain UI components into MediConnect's `src/components/{dashboard,medications,chat}/` directories. Each component is restyled to use Phase 1's CSS variables (no hardcoded `#FC94AF`), decoupled from Amelia's AI/memory types, and re-wired to props that match MediConnect's data shapes. Phase 4 (page restyle) consumes these.

**Architecture decision:** Plan is **spec-driven**, not source-transcribing. Each task gives the new file path, target prop interface, and a delta list against the Amelia source. The implementer reads `.amelia-source/components/<name>.tsx` for the visual reference and applies the changes. This is faster than embedding 200-line code blocks per task and avoids drift.

**Tech Stack additions:** `react-markdown` + `remark-gfm` (used by Amelia's ChatMessage for markdown rendering) — likely already installed; install if missing.

**Working directory:** `C:\Users\IKA\Nala Vita\`. Branch: `hybrid-phase-3-domain-ui` (off `hybrid-phase-2-complete`).

---

## Scope

### Porting (Tier 1 + Tier 2 — 7 components)

| # | Source | Target | Lines | Adaptation level |
|---|---|---|---|---|
| 1 | `MedicationSchedule.tsx` | `src/components/medications/MedicationSchedule.tsx` | 40 | Simple — replace `#FC94AF` with `var(--primary)` |
| 2 | `charts/PatientIntakeChart.tsx` | `src/components/dashboard/PatientIntakeChart.tsx` | 94 | Simple — colour tokens |
| 3 | `TypingIndicator.tsx` | `src/components/chat/TypingIndicator.tsx` | 26 | Drop `NurseAvatar` dep, generic dot indicator with primary tint |
| 4 | `AddMedicationModal.tsx` | `src/components/medications/AddMedicationModal.tsx` | 198 | Generic `onAdd` callback (already correct), colour tokens |
| 5 | `HealthDashboard.tsx` | `src/components/dashboard/HealthDashboard.tsx` | 180 | Drop `triggerAlert` + `activeTheme` props, accept generic vitals data instead of `user` |
| 6 | `ChatMessage.tsx` | `src/components/chat/ChatMessage.tsx` | 179 | New `Message` shape `{isMine, content, imageUrl, sentAt}`, drop `NurseAvatar`, drop speech-synthesis (defer) |
| 7 | `ChatInput.tsx` | `src/components/chat/ChatInput.tsx` | 192 | Drop voice (mic) feature, keep send + image attach |

### Deferred (Tier 3)

| Component | Why deferred |
|---|---|
| `NurseAvatar.tsx` | No AI assistant in the new design (Amelia memory is gone). If needed in a later AI feature, port then. |
| `SettingsModal.tsx` | MediConnect has a full Settings page (`SettingsPanel.tsx`) — modal version not needed. |
| `AddPatientModal.tsx` (457 lines) | Doctor-side patient-add flow; needs Phase 5 / clinical workflow first. |
| `UploadPatientModal.tsx` (176 lines) | Same — doctor patient-upload flow lives later. |
| `AmeliaAlert.tsx` | Amelia branding component; MediConnect uses `toast.tsx` already. |
| `Sidebar.tsx` | Amelia chat-history sidebar; superseded by `SidebarShell` (Phase 2). |

---

## Pre-flight

- Confirm `hybrid-phase-2-complete` tag exists.
- Confirm 39 tests pass on Phase 2 tip.
- Confirm `framer-motion`, `recharts`, `react-markdown`, `remark-gfm` are installed. If `react-markdown`/`remark-gfm` are absent, install in Task 1 (preflight install).

---

## File map

### Created
- `src/components/medications/MedicationSchedule.tsx`
- `src/components/medications/AddMedicationModal.tsx`
- `src/components/dashboard/PatientIntakeChart.tsx`
- `src/components/dashboard/HealthDashboard.tsx`
- `src/components/chat/TypingIndicator.tsx`
- `src/components/chat/ChatMessage.tsx`
- `src/components/chat/ChatInput.tsx`
- 1 test file per component → `src/__tests__/components/<name>.test.tsx`

### Reference (read-only)
- `.amelia-source/components/*.tsx` — Amelia visual source

### Not touched
- Existing `src/app/(patient)/patient/dashboard/page.tsx`, `…medications/page.tsx`, `…chat/[id]/page.tsx`, etc. — these get restyled in Phase 4. Phase 3 just makes the components available.
- Prisma schema, middleware, API routes.

---

## Universal adaptation rules (apply to every ported component)

1. **No hardcoded hex.** Replace `#FC94AF` → `var(--primary)`, `#FFF0F3` → `var(--bg-tint)`, `#881337` → `var(--text-on-tint)`. Use Tailwind arbitrary values `bg-[var(--primary)]`, `text-[var(--primary)]`, `bg-[var(--primary)]/10`.
2. **Drop `activeTheme` and `Theme` props.** Components read theme from CSS variables, not from a prop. Remove `activeTheme: Theme` from interfaces.
3. **Drop `lib/types` imports.** Amelia's `lib/types.ts` (with `USER`/`AMELIA`/`Theme` types) is gone. Each component declares its own narrow props.
4. **Drop Amelia-coupled props.** Where a component takes `triggerAlert`, `user`, `activeTheme` — replace with the narrowest data the component actually needs (e.g., vitals object instead of full user).
5. **Match existing Tailwind 3 syntax.** No `@import "tailwindcss"`, no v4-only utilities.
6. **Add `"use client"`** at the top of every component that uses state or hooks (almost all of them).
7. **Tests for every component.** Minimum: renders without errors, key interactive behavior works. See per-task spec.
8. **Watch for unused imports.** ESLint fails the build on these — bit us twice already.

---

## Tasks

### Task 0: Branch + baseline verify + preflight install

- [ ] **Step 1:** Branch

```bash
cd "/c/Users/IKA/Nala Vita"
git checkout -b hybrid-phase-3-domain-ui hybrid-phase-2-complete
git tag hybrid-phase-3-start
```

- [ ] **Step 2:** Verify baseline

```bash
npm test 2>&1 | tail -5
```
Expected: 39 passed.

- [ ] **Step 3:** Check `react-markdown` + `remark-gfm` presence (Amelia's ChatMessage uses them)

```bash
node -e "['react-markdown','remark-gfm'].forEach(p => { try { require.resolve(p); console.log('ok:',p); } catch { console.log('MISSING:',p); }})"
```

- [ ] **Step 4:** If either is MISSING, install:

```bash
npm install react-markdown remark-gfm
```
Then re-verify with the `node -e` line.

- [ ] **Step 5:** Commit (only if anything was installed)

```bash
git add package.json package-lock.json
git commit -m "chore: install react-markdown + remark-gfm

Used by Amelia's ChatMessage for markdown rendering (Task 6).

Hybrid Phase 3 / Task 0

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If both deps were already present, skip the commit and note "no install needed".

---

### Task 1: Port `MedicationSchedule` (40-line visual, TDD)

**Source:** `.amelia-source/components/MedicationSchedule.tsx`
**Target:** `src/components/medications/MedicationSchedule.tsx`
**Test:** `src/__tests__/components/MedicationSchedule.test.tsx`

**Prop interface (new):**

```typescript
interface Medication {
  id?: string;
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
}

interface Props {
  medications: Medication[];
}
```

**Deltas from Amelia source:**
- `instructions` becomes optional (Amelia required it; MediConnect's data may have null).
- Each card's `border-l-4 border-[#FC94AF]` → `border-l-4 border-[var(--primary)]`.
- Header text `text-[#FC94AF]` → `text-[var(--primary)]`.
- Dosage pill `bg-pink-50 text-pink-600` → `bg-[var(--primary)]/10 text-[var(--primary)]`.
- Empty state already correct (gray text).
- Keep the `key={idx}` only if no `id` is provided; prefer `key={med.id ?? med.name + idx}` to suppress React warnings about array-index keys.

**Tests (4):**

```tsx
import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import MedicationSchedule from "@/components/medications/MedicationSchedule";

describe("MedicationSchedule", () => {
  it("renders empty state when there are no medications", () => {
    render(<MedicationSchedule medications={[]} />);
    expect(screen.getByText(/no active medications/i)).toBeInTheDocument();
  });

  it("renders one card per medication", () => {
    render(<MedicationSchedule medications={[
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
      { name: "Metformin", dosage: "500mg", frequency: "Twice daily" },
    ]} />);
    expect(screen.getByText(/lisinopril/i)).toBeInTheDocument();
    expect(screen.getByText(/metformin/i)).toBeInTheDocument();
  });

  it("shows dosage and frequency", () => {
    render(<MedicationSchedule medications={[
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
    ]} />);
    expect(screen.getByText("10mg")).toBeInTheDocument();
    expect(screen.getByText(/once daily/i)).toBeInTheDocument();
  });

  it("renders instructions when provided", () => {
    render(<MedicationSchedule medications={[
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily", instructions: "Take with food" },
    ]} />);
    expect(screen.getByText(/take with food/i)).toBeInTheDocument();
  });
});
```

**Commit:**
```
feat(medications): port MedicationSchedule from Amelia

Restyled with var(--primary) so card highlight tracks the active
theme. Instructions field now optional. 4 jest tests.

Hybrid Phase 3 / Task 1

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 2: Port `PatientIntakeChart` (94-line chart, TDD-light)

**Source:** `.amelia-source/components/charts/PatientIntakeChart.tsx`
**Target:** `src/components/dashboard/PatientIntakeChart.tsx`
**Test:** `src/__tests__/components/PatientIntakeChart.test.tsx`

**Prop interface:** Read what Amelia uses (likely `data: { date: string; water: number; steps: number }[]` or similar). Preserve verbatim, but if Amelia uses Theme-derived colors, replace with `var(--primary)`.

**Deltas:**
- Drop any `activeTheme` prop.
- Replace inline color props on `<Bar>` / `<Line>` with `var(--primary)` via either `getComputedStyle` (runtime) OR a hardcoded fallback color. **Simpler approach:** import the `THEMES` const from `@/lib/themes` and use `THEMES.rose.primary` as the static fallback; document that the chart's bar color won't live-update with theme changes — leave a `// TODO: hook into ThemeContext` comment. This is acceptable scope for Phase 3; live-tinting recharts is a Phase 4+ polish.

**Tests (2 minimum):**

```tsx
import { describe, it, expect } from "@jest/globals";
import { render } from "@testing-library/react";
import PatientIntakeChart from "@/components/dashboard/PatientIntakeChart";

describe("PatientIntakeChart", () => {
  it("renders with empty data without crashing", () => {
    const { container } = render(<PatientIntakeChart data={[]} />);
    expect(container).toBeInTheDocument();
  });

  it("renders with sample data", () => {
    const { container } = render(<PatientIntakeChart data={[
      { date: "2026-05-20", water: 2, steps: 8000 },
      { date: "2026-05-21", water: 1.5, steps: 7500 },
    ]} />);
    expect(container).toBeInTheDocument();
  });
});
```

> **Note for executor:** recharts in jsdom often throws warnings about width — these are non-fatal. The tests just verify no crash. Adapt the `data` shape to match what Amelia's component actually expects.

**Commit:**
```
feat(dashboard): port PatientIntakeChart from Amelia

Recharts-based intake chart. Uses THEMES.rose.primary as the static
bar colour; live theme tinting deferred to a Phase 4 ThemeContext.

Hybrid Phase 3 / Task 2

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 3: Port `TypingIndicator` (26-line, TDD)

**Source:** `.amelia-source/components/TypingIndicator.tsx`
**Target:** `src/components/chat/TypingIndicator.tsx`
**Test:** `src/__tests__/components/TypingIndicator.test.tsx`

**Prop interface:** None (no props needed in MediConnect — the typing indicator is generic).

**Deltas:**
- **Drop `NurseAvatar` import entirely.** Replace the avatar `<div>` with either nothing (just the dots) or a generic gray circle. Recommended: just the dots bubble — cleaner in patient↔doctor chat.
- **Drop `activeTheme` prop.** Replace `style={{ backgroundColor: activeTheme.primary }}` (if used) with className-based tinting.
- **Drop the `Theme` import.**

**Final shape (specify in detail since this is the most adapted):**

```tsx
"use client";

export default function TypingIndicator() {
  return (
    <div className="flex items-center w-full animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex gap-1.5 bg-gray-50 dark:bg-[#2B2D31] px-4 py-3.5 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" />
        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
    </div>
  );
}
```

**Tests (1):**

```tsx
import { describe, it, expect } from "@jest/globals";
import { render } from "@testing-library/react";
import TypingIndicator from "@/components/chat/TypingIndicator";

describe("TypingIndicator", () => {
  it("renders three animated dots", () => {
    const { container } = render(<TypingIndicator />);
    expect(container.querySelectorAll(".animate-bounce")).toHaveLength(3);
  });
});
```

**Commit:**
```
feat(chat): port TypingIndicator (NurseAvatar removed)

Generic three-dot indicator. Drops the Amelia AI nurse avatar
since the new chat is patient↔human-doctor.

Hybrid Phase 3 / Task 3

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 4: Port `AddMedicationModal` (198-line modal, TDD)

**Source:** `.amelia-source/components/AddMedicationModal.tsx`
**Target:** `src/components/medications/AddMedicationModal.tsx`
**Test:** `src/__tests__/components/AddMedicationModal.test.tsx`

**Prop interface:**

```typescript
interface MedicationInput {
  name: string;
  dosage: string;
  frequency: string;
  times: string[];
  instructions?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (medication: MedicationInput) => Promise<void>;
}
```

**Deltas from Amelia source:**
- Replace any `#FC94AF` hex with `var(--primary)`.
- Form submit button: `bg-[#FC94AF]` → `bg-[var(--primary)]`, `hover:bg-pink-500` → drop (use opacity-90).
- `Activity` icon accent color tokens.
- Keep `framer-motion` `motion.div` + `AnimatePresence` for modal animation (already a dep).
- The `onAdd: (medication: any)` signature in Amelia → use the typed `MedicationInput` above.

**Tests (4):**

```tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import AddMedicationModal from "@/components/medications/AddMedicationModal";

const onClose = jest.fn();
const onAdd = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  onClose.mockClear();
  onAdd.mockClear();
});

describe("AddMedicationModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(<AddMedicationModal isOpen={false} onClose={onClose} onAdd={onAdd} />);
    expect(container.querySelector("form")).toBeNull();
  });

  it("renders form fields when open", () => {
    render(<AddMedicationModal isOpen={true} onClose={onClose} onAdd={onAdd} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dosage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/frequency/i)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    render(<AddMedicationModal isOpen={true} onClose={onClose} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: /close|cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onAdd with form data on submit", async () => {
    render(<AddMedicationModal isOpen={true} onClose={onClose} onAdd={onAdd} />);
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Lisinopril" } });
    fireEvent.change(screen.getByLabelText(/dosage/i), { target: { value: "10mg" } });
    fireEvent.click(screen.getByRole("button", { name: /add|save|submit/i }));
    // wait microtask
    await Promise.resolve();
    expect(onAdd).toHaveBeenCalled();
    const arg = onAdd.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.name).toBe("Lisinopril");
    expect(arg.dosage).toBe("10mg");
  });
});
```

> **Adapt label selectors** to whatever the Amelia source actually uses — if Amelia's labels are placeholder text not actual `<label>` elements, use `getByPlaceholderText` instead.

**Commit:**
```
feat(medications): port AddMedicationModal from Amelia

Form modal: name/dosage/frequency/times/instructions. Typed onAdd
callback (was 'any' in Amelia). Restyled with var(--primary).

Hybrid Phase 3 / Task 4

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 5: Port `HealthDashboard` (180-line, ADAPTED)

**Source:** `.amelia-source/components/HealthDashboard.tsx`
**Target:** `src/components/dashboard/HealthDashboard.tsx`
**Test:** `src/__tests__/components/HealthDashboard.test.tsx`

**Adaptation philosophy:** The Amelia version wraps in modal-style overlay (`isOpen`/`setIsOpen`) and calls a parent `triggerAlert` for feedback. MediConnect's patient dashboard PAGE will render this inline as a section, not a modal. So:

**New prop interface:**

```typescript
interface DailyVitals {
  waterLiters: number;
  steps: number;
  medsTaken: boolean;
}

interface Props {
  initialVitals?: DailyVitals;
  onUpdate?: (vitals: DailyVitals) => Promise<void>;
}
```

**Deltas:**
- **Remove modal wrapping** — return a `<div className="rounded-2xl border border-gray-100 bg-white p-6 …">` instead of a fixed overlay.
- **Drop `isOpen` / `setIsOpen` / `X` close button.** Component is always visible when rendered.
- **Drop `triggerAlert`** — failures are silent or surfaced via parent prop callbacks (`onUpdate` rejection).
- **Drop `user` and `activeTheme` props.**
- **Drop the date-fetching `useEffect`** — instead accept the daily-log timestamp as an internal `new Date().toISOString().split('T')[0]` derived value.
- **Drop the fetch-to-`/api/patients/me/logs` API call** — pass that responsibility to the parent via `onUpdate`. Component is pure UI.
- Replace `#FC94AF` hex with `var(--primary)`.
- The `Droplets`, `Pill`, `Activity`, `CalendarDays`, `Plus`, `Minus`, `CheckCircle2` icons stay.

**Tests (4):**

```tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import HealthDashboard from "@/components/dashboard/HealthDashboard";

const onUpdate = jest.fn().mockResolvedValue(undefined);
beforeEach(() => onUpdate.mockClear());

describe("HealthDashboard", () => {
  it("renders water, steps, and meds sections", () => {
    render(<HealthDashboard />);
    expect(screen.getByText(/water/i)).toBeInTheDocument();
    expect(screen.getByText(/steps/i)).toBeInTheDocument();
    expect(screen.getByText(/medications?/i)).toBeInTheDocument();
  });

  it("uses initialVitals when provided", () => {
    render(<HealthDashboard initialVitals={{ waterLiters: 2.5, steps: 8000, medsTaken: true }} />);
    expect(screen.getByText(/2\.5/)).toBeInTheDocument();
    expect(screen.getByText(/8000|8,000/)).toBeInTheDocument();
  });

  it("increments water on plus click", () => {
    render(<HealthDashboard initialVitals={{ waterLiters: 1, steps: 0, medsTaken: false }} />);
    const plusButtons = screen.getAllByRole("button", { name: /\+|plus/i });
    fireEvent.click(plusButtons[0]);
    // value should now be > 1
    expect(screen.queryByText("1.0") || screen.queryByText("1.5") || screen.queryByText("2")).not.toBeNull();
  });

  it("calls onUpdate when a vital changes (debounced or immediate, but eventually)", async () => {
    render(<HealthDashboard initialVitals={{ waterLiters: 1, steps: 0, medsTaken: false }} onUpdate={onUpdate} />);
    const plusButtons = screen.getAllByRole("button", { name: /\+|plus/i });
    fireEvent.click(plusButtons[0]);
    // Give the component a microtask to call onUpdate
    await new Promise(r => setTimeout(r, 50));
    expect(onUpdate).toHaveBeenCalled();
  });
});
```

> **Adapt test assertions** to whatever icon labels / aria-labels Amelia actually uses. Use `screen.getByRole` with `name` regex; fall back to `getByText` if needed.

**Commit:**
```
feat(dashboard): port HealthDashboard from Amelia (inline, not modal)

Adapted from Amelia's modal-overlay form to an inline dashboard
section. Drops triggerAlert/activeTheme/user props; accepts
generic initialVitals + onUpdate callback. Parent handles
persistence.

Hybrid Phase 3 / Task 5

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 6: Port `ChatMessage` (179-line, ADAPTED for human↔human)

**Source:** `.amelia-source/components/ChatMessage.tsx`
**Target:** `src/components/chat/ChatMessage.tsx`
**Test:** `src/__tests__/components/ChatMessage.test.tsx`

**Adaptation philosophy:** Amelia's version renders messages as patient↔AI exchanges with the `NurseAvatar` for AI messages. MediConnect's chat is patient↔doctor — the "other side" needs an avatar that can show either party's initials. We replace `NurseAvatar` with a generic `PersonAvatar` rendered inline (no new file — just the JSX block).

**New prop interface:**

```typescript
interface ChatMessageProps {
  /** True when the message was sent by the local viewer (right-aligned bubble). False = other party (left-aligned). */
  isMine: boolean;
  /** Message body (markdown supported). */
  content: string;
  /** Optional attached image URL. */
  imageUrl?: string;
  /** ISO timestamp; used for `aria-label` / hover tooltip. */
  sentAt: string;
  /** Initials shown in the other-party avatar (ignored when isMine). */
  otherInitials?: string;
}
```

**Deltas:**
- **Drop `Message`/`USER`/`AMELIA`/`Theme` imports.** Define props locally.
- **Drop `NurseAvatar`.** Replace its render block with a `<div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] …">{otherInitials ?? "?"}</div>`.
- **Keep `react-markdown` + `remark-gfm` for markdown rendering.**
- **Drop speech synthesis (`Volume2` / `Square` / `window.speechSynthesis`).** Patient↔doctor messaging doesn't need text-to-speech in scope of this phase. Comment a `// TODO Phase 4+: optional TTS` if anyone wants it later.
- **Keep `Copy` / `Check` button** for copy-to-clipboard.
- **`isUser` becomes `isMine`** (semantic rename — the "user" in human↔human chat is always whoever is viewing).
- **`hasImageText` logic stays** but in MediConnect, image attachments are URLs (`fileUrl`), not embedded `[Image Attached]` text prefixes — just check `imageUrl` directly.

**Tests (5):**

```tsx
import { describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import ChatMessage from "@/components/chat/ChatMessage";

describe("ChatMessage", () => {
  it("right-aligns when isMine=true", () => {
    const { container } = render(<ChatMessage isMine={true} content="Hi" sentAt="2026-05-22T10:00:00Z" />);
    // The bubble container should have justify-end or self-end somewhere
    expect(container.innerHTML).toMatch(/justify-end|self-end|ml-auto/);
  });

  it("left-aligns and shows other-party avatar when isMine=false", () => {
    render(<ChatMessage isMine={false} content="Hi" sentAt="2026-05-22T10:00:00Z" otherInitials="DR" />);
    expect(screen.getByText("DR")).toBeInTheDocument();
  });

  it("renders content text", () => {
    render(<ChatMessage isMine={true} content="Hello there" sentAt="2026-05-22T10:00:00Z" />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders an image when imageUrl is provided", () => {
    render(<ChatMessage isMine={false} content="See this scan" imageUrl="https://x.test/scan.png" sentAt="2026-05-22T10:00:00Z" otherInitials="DR" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://x.test/scan.png");
  });

  it("renders markdown in content", () => {
    render(<ChatMessage isMine={true} content="**bold** _italic_" sentAt="2026-05-22T10:00:00Z" />);
    // react-markdown should produce a <strong> and an <em>
    expect(screen.getByText("bold").tagName.toLowerCase()).toBe("strong");
  });
});
```

**Commit:**
```
feat(chat): port ChatMessage from Amelia (human↔human, no NurseAvatar)

New prop shape: { isMine, content, imageUrl?, sentAt, otherInitials? }.
Drops Amelia's Message/Theme types, speech-synthesis playback, and
NurseAvatar. Keeps markdown rendering and copy-to-clipboard.

Hybrid Phase 3 / Task 6

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 7: Port `ChatInput` (192-line, ADAPTED — no AI voice)

**Source:** `.amelia-source/components/ChatInput.tsx`
**Target:** `src/components/chat/ChatInput.tsx`
**Test:** `src/__tests__/components/ChatInput.test.tsx`

**New prop interface:**

```typescript
interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => Promise<void> | void;
  isSending?: boolean;
  imageFile?: File | null;
  onImageChange?: (f: File | null) => void;
}
```

**Deltas:**
- Rename `inputText`/`setInputText` → `value`/`onChange` (standard React controlled-input idiom).
- Rename `sendMessage` → `onSend`.
- Rename `isLoading` → `isSending`.
- **Drop voice input (`isListening`, mic button, SpeechRecognition).** Keep only send button, image attach (Paperclip), text area.
- **Drop `activeTheme` prop.** Replace tints with `var(--primary)`.
- Send button: disabled when `value` is empty AND no `imageFile`. `isSending` shows a spinner.
- Auto-resize textarea logic from Amelia stays (useRef + useEffect).

**Tests (5):**

```tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatInput from "@/components/chat/ChatInput";

const onChange = jest.fn();
const onSend = jest.fn();

beforeEach(() => {
  onChange.mockClear();
  onSend.mockClear();
});

describe("ChatInput", () => {
  it("renders the textarea and send button", () => {
    render(<ChatInput value="" onChange={onChange} onSend={onSend} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("calls onChange on typing", () => {
    render(<ChatInput value="" onChange={onChange} onSend={onSend} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hi" } });
    expect(onChange).toHaveBeenCalledWith("hi");
  });

  it("disables send when value is empty and no image", () => {
    render(<ChatInput value="" onChange={onChange} onSend={onSend} />);
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("enables send when value has content", () => {
    render(<ChatInput value="hello" onChange={onChange} onSend={onSend} />);
    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
  });

  it("calls onSend on send button click", () => {
    render(<ChatInput value="hello" onChange={onChange} onSend={onSend} />);
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalled();
  });
});
```

**Commit:**
```
feat(chat): port ChatInput from Amelia (no voice, controlled input)

Standard controlled-input API: { value, onChange, onSend, isSending,
imageFile, onImageChange }. Drops Amelia's voice/mic feature
(SpeechRecognition). Keeps image attach + auto-resize textarea.

Hybrid Phase 3 / Task 7

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

### Task 8: End-of-phase verification + tag

- [ ] **Step 1:** Full test suite

```bash
cd "/c/Users/IKA/Nala Vita"
npm test 2>&1 | tail -10
```
Expected: previous 39 + ~25 new (4+2+1+4+4+5+5) = **~64 tests pass**.

- [ ] **Step 2:** Clean build

```bash
rm -rf .next && npm run build 2>&1 | tail -15
```
Expected: exit 0, no "Failed to compile", no new ESLint errors.

- [ ] **Step 3:** Refresh graph

```bash
graphify update "C:\Users\IKA\Nala Vita" 2>&1 | tail -5
```

- [ ] **Step 4:** Tag

```bash
git tag hybrid-phase-3-complete
git log --oneline hybrid-phase-3-complete ^hybrid-phase-3-start
```
Expected: 7-8 commits (Tasks 0–7).

---

## Self-review (executor: read before starting)

**Spec coverage:** All 7 Tier 1+2 components are ported. Tier 3 (NurseAvatar, AddPatientModal, UploadPatientModal, SettingsModal, AmeliaAlert) explicitly deferred — call out in commit messages where relevant.

**Adaptation rules apply universally** — see "Universal adaptation rules" section. No hardcoded hex anywhere.

**Out of scope:**
- Restyling existing pages — Phase 4
- Wiring new components into existing pages — Phase 4
- Live-tinting recharts charts — deferred (static fallback in Task 2)
- Speech synthesis on chat messages — deferred
- Voice mic input on chat — deferred

**Failure modes:**

- **`react-markdown` ESM/CJS interop:** v9+ is ESM-only; if jest complains about ESM, ensure `transformIgnorePatterns` in `jest.config.js` allows it. Check `cat jest.config.js` and add `"node_modules/(?!react-markdown|remark-gfm)/"` to `transformIgnorePatterns` if needed (Task 6).
- **recharts jsdom warnings:** the chart renders width=0 in jsdom and prints a warning. Tests that just assert "no crash" pass anyway. If tests fail on the warning, suppress it with `jest.spyOn(console, 'warn').mockImplementation(() => {});` in `beforeEach`.
- **Tailwind arbitrary-value classes `bg-[var(--primary)]/10`:** Tailwind 3 supports these but requires JIT cache flush — if a color doesn't apply, run `rm -rf .next && npm run build`.
- **Unused imports kill the build.** Triple-check imports after deleting `NurseAvatar`, `Theme`, `Message`, `Volume2`, mic icons, etc.

---

## Execution handoff

Plan saved. Subagent-driven execution per Phase 1/2 pattern. Each task = one subagent dispatch with spec + quality review where the task involves logic (Tasks 5, 6, 7); simple visual ports (Tasks 1, 3) can be implementer-only.
