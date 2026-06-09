# Amelia Phase 2 — Medication Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proactively warn patients about potential drug interactions, dosing concerns, and allergy conflicts across their active meds — via an auto-running cached safety panel on the medications page plus a notification when a doctor prescribes a new drug.

**Architecture:** A new `src/lib/amelia/medsafety.ts` (gpt-4o analysis + a deterministic allergy net + an in-memory cache keyed by med-list hash). A rate-limited `GET /api/amelia/med-safety` feeds an auto-fetching `MedSafetyPanel` on the meds page. The doctor's `POST /api/prescriptions` route calls `checkNewPrescriptionSafety` best-effort after creating a prescription. No new DB tables.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, OpenAI (gpt-4o), Zod, Jest (node + jsdom).

**Spec:** `docs/superpowers/specs/2026-06-09-amelia-phase-2-medication-coach-design.md`

---

## File Structure

**Create:**
- `src/lib/amelia/medsafety.ts` — types, hash, allergy net, analysis, cache, prescription-safety check
- `src/app/api/amelia/med-safety/route.ts` — `GET` analysis for the patient
- `src/components/amelia/MedSafetyPanel.tsx` — the meds-page panel
- Tests under `src/__tests__/lib/amelia/`, `…/api/amelia/`, `…/components/amelia/`

**Modify:**
- `src/app/api/prescriptions/route.ts` — best-effort `checkNewPrescriptionSafety` after create
- `src/app/(patient)/patient/medications/page.tsx` — render `MedSafetyPanel`

---

## Task 0: Branch + baseline

- [ ] **Step 1:** `cd "C:/Users/IKA/Nala Vita" && git checkout -b feat/amelia-phase-2-medcoach`
- [ ] **Step 2:** Run `npx tsc --noEmit -p . && npm test` → tsc clean, all suites pass.

---

## Task 1: medsafety hash + allergy net (TDD, pure)

**Files:**
- Create: `src/lib/amelia/medsafety.ts` (first part)
- Test: `src/__tests__/lib/amelia/medsafety-pure.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/medsafety-pure.test.ts
import { describe, it, expect, jest } from "@jest/globals";
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { medListHash, exactAllergyMatches } from "@/lib/amelia/medsafety";

describe("medListHash", () => {
  it("is order-independent and case-insensitive", () => {
    const a = medListHash([{ medication: "Lisinopril", dosage: "10mg" }, { medication: "Aspirin", dosage: "81mg" }]);
    const b = medListHash([{ medication: "aspirin", dosage: "81MG" }, { medication: "lisinopril", dosage: "10MG" }]);
    expect(a).toBe(b);
  });
  it("changes when a med changes", () => {
    const a = medListHash([{ medication: "Aspirin", dosage: "81mg" }]);
    const b = medListHash([{ medication: "Aspirin", dosage: "325mg" }]);
    expect(a).not.toBe(b);
  });
});

describe("exactAllergyMatches", () => {
  it("flags a med whose name contains a listed allergy", () => {
    const out = exactAllergyMatches([{ medication: "Penicillin V", dosage: "500mg" }], ["penicillin"]);
    expect(out).toHaveLength(1);
    expect(out[0].medication).toBe("Penicillin V");
    expect(out[0].allergy).toBe("penicillin");
  });
  it("returns nothing when there is no match", () => {
    expect(exactAllergyMatches([{ medication: "Aspirin", dosage: "81mg" }], ["penicillin"])).toHaveLength(0);
  });
});
```

- [ ] **Step 2:** Run `npx jest src/__tests__/lib/amelia/medsafety-pure.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create `src/lib/amelia/medsafety.ts`**

```typescript
// src/lib/amelia/medsafety.ts
import { prisma } from "@/lib/prisma";
import { chat } from "./llm";
import { createNotification } from "@/lib/notifications";

export type Severity = "high" | "moderate" | "low";

export interface MedSafetyResult {
  interactions: { drugs: string[]; severity: Severity; note: string }[];
  dosingNotes: { medication: string; note: string }[];
  allergyConflicts: { medication: string; allergy: string; note: string }[];
  overallNote: string;
}

export interface MedInput {
  medication: string;
  dosage: string;
}

export function medListHash(meds: MedInput[]): string {
  return meds
    .map((m) => `${m.medication.toLowerCase().trim()}|${m.dosage.toLowerCase().trim()}`)
    .sort()
    .join("~");
}

export function exactAllergyMatches(
  meds: MedInput[],
  allergies: string[]
): { medication: string; allergy: string; note: string }[] {
  const out: { medication: string; allergy: string; note: string }[] = [];
  for (const m of meds) {
    const medLower = m.medication.toLowerCase();
    for (const a of allergies) {
      const aLower = a.toLowerCase().trim();
      if (aLower && medLower.includes(aLower)) {
        out.push({ medication: m.medication, allergy: a, note: `${m.medication} matches a listed allergy (${a}).` });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4:** Run the test → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/medsafety.ts src/__tests__/lib/amelia/medsafety-pure.test.ts
git commit -m "feat(amelia): med-safety hash + deterministic allergy net (TDD)"
```

---

## Task 2: analyze + cache (TDD, mocked llm)

**Files:**
- Modify: `src/lib/amelia/medsafety.ts` (append)
- Test: `src/__tests__/lib/amelia/medsafety-analyze.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/medsafety-analyze.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
const chat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { analyzeMedications, getCachedOrAnalyze } from "@/lib/amelia/medsafety";

beforeEach(() => chat.mockReset());

describe("analyzeMedications", () => {
  it("parses the LLM result and merges the deterministic allergy net", async () => {
    chat.mockResolvedValue('{"interactions":[{"drugs":["aspirin","warfarin"],"severity":"high","note":"bleeding risk"}],"dosingNotes":[],"allergyConflicts":[],"overallNote":"confirm with a professional"}');
    const out = await analyzeMedications(
      [{ medication: "Penicillin V", dosage: "500mg" }, { medication: "Aspirin", dosage: "81mg" }],
      ["penicillin"]
    );
    expect(out.interactions[0].severity).toBe("high");
    // deterministic net adds the penicillin conflict even though the LLM returned none
    expect(out.allergyConflicts.some((c) => c.allergy === "penicillin")).toBe(true);
  });

  it("falls back to a safe advisory note on bad JSON", async () => {
    chat.mockResolvedValue("not json");
    const out = await analyzeMedications([{ medication: "Aspirin", dosage: "81mg" }], []);
    expect(out.interactions).toEqual([]);
    expect(out.overallNote).toMatch(/confirm/i);
  });

  it("short-circuits with no meds (no LLM call)", async () => {
    const out = await analyzeMedications([], []);
    expect(chat).not.toHaveBeenCalled();
    expect(out.overallNote).toMatch(/no active medications/i);
  });
});

describe("getCachedOrAnalyze", () => {
  it("caches by med list — second call with same meds does not re-run the LLM", async () => {
    chat.mockResolvedValue('{"interactions":[],"dosingNotes":[],"allergyConflicts":[],"overallNote":"ok"}');
    const meds = [{ medication: "Aspirin", dosage: "81mg" }];
    await getCachedOrAnalyze("patC", meds, []);
    await getCachedOrAnalyze("patC", meds, []);
    expect(chat).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2:** Run `npx jest src/__tests__/lib/amelia/medsafety-analyze.test.ts` → FAIL.

- [ ] **Step 3: Append to `src/lib/amelia/medsafety.ts`**

```typescript

function mergeConflicts(
  llm: { medication: string; allergy: string; note: string }[],
  det: { medication: string; allergy: string; note: string }[]
): { medication: string; allergy: string; note: string }[] {
  const seen = new Set(llm.map((c) => `${c.medication.toLowerCase()}|${c.allergy.toLowerCase()}`));
  return [...llm, ...det.filter((c) => !seen.has(`${c.medication.toLowerCase()}|${c.allergy.toLowerCase()}`))];
}

const ADVISORY = "These are potential concerns — confirm with your pharmacist or doctor.";

export async function analyzeMedications(meds: MedInput[], allergies: string[]): Promise<MedSafetyResult> {
  const deterministic = exactAllergyMatches(meds, allergies);
  if (meds.length === 0) {
    return { interactions: [], dosingNotes: [], allergyConflicts: deterministic, overallNote: "No active medications on record." };
  }

  const medLines = meds.map((m) => `- ${m.medication} ${m.dosage}`).join("\n");
  const allergyLine = allergies.length ? allergies.join(", ") : "none on record";
  const raw = await chat(
    [
      {
        role: "system",
        content:
          'You are a medication-safety assistant. Review the patient\'s medications and allergies. Return ONLY JSON (no prose, no code fences): {"interactions":[{"drugs":[".."],"severity":"high|moderate|low","note":".."}],"dosingNotes":[{"medication":"..","note":".."}],"allergyConflicts":[{"medication":"..","allergy":"..","note":".."}],"overallNote":".."}. Flag only POTENTIAL concerns; keep notes short. Recognise drug-class allergy conflicts (e.g. amoxicillin with a penicillin allergy). Never invent medications not in the list. Keep overallNote advisory. If nothing notable, return empty arrays with the advisory note.',
      },
      { role: "user", content: `Medications:\n${medLines}\nAllergies: ${allergyLine}` },
    ],
    { temperature: 0.2, maxTokens: 700 }
  );

  let parsed: Partial<MedSafetyResult> = {};
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = {};
  }

  return {
    interactions: Array.isArray(parsed.interactions) ? parsed.interactions : [],
    dosingNotes: Array.isArray(parsed.dosingNotes) ? parsed.dosingNotes : [],
    allergyConflicts: mergeConflicts(Array.isArray(parsed.allergyConflicts) ? parsed.allergyConflicts : [], deterministic),
    overallNote: typeof parsed.overallNote === "string" && parsed.overallNote.trim() ? parsed.overallNote : ADVISORY,
  };
}

const cache = new Map<string, { hash: string; result: MedSafetyResult }>();

export async function getCachedOrAnalyze(patientId: string, meds: MedInput[], allergies: string[]): Promise<MedSafetyResult> {
  const hash = medListHash(meds) + "::" + [...allergies].map((a) => a.toLowerCase().trim()).sort().join(",");
  const cached = cache.get(patientId);
  if (cached && cached.hash === hash) return cached.result;
  const result = await analyzeMedications(meds, allergies);
  cache.set(patientId, { hash, result });
  return result;
}
```

- [ ] **Step 4:** Run the test → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/medsafety.ts src/__tests__/lib/amelia/medsafety-analyze.test.ts
git commit -m "feat(amelia): gpt-4o medication analysis + in-memory cache (TDD)"
```

---

## Task 3: checkNewPrescriptionSafety (TDD, mocked prisma + llm + notify)

**Files:**
- Modify: `src/lib/amelia/medsafety.ts` (append)
- Test: `src/__tests__/lib/amelia/medsafety-newrx.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/medsafety-newrx.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
const chat = jest.fn();
const findUnique = jest.fn();
const createNotification = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));
jest.mock("@/lib/prisma", () => ({ prisma: { patient: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));
jest.mock("@/lib/notifications", () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }));

import { checkNewPrescriptionSafety } from "@/lib/amelia/medsafety";

beforeEach(() => { chat.mockReset(); findUnique.mockReset(); createNotification.mockReset(); });

describe("checkNewPrescriptionSafety", () => {
  it("notifies when a high-severity interaction involves the new med", async () => {
    findUnique.mockResolvedValue({ userId: "u1", allergies: [], prescriptions: [{ medication: "warfarin", dosage: "5mg" }, { medication: "aspirin", dosage: "81mg" }] });
    chat.mockResolvedValue('{"interactions":[{"drugs":["aspirin","warfarin"],"severity":"high","note":"bleeding"}],"dosingNotes":[],"allergyConflicts":[],"overallNote":"x"}');
    await checkNewPrescriptionSafety("pat1", "aspirin");
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(createNotification).toHaveBeenCalledWith("u1", "Medication safety", expect.any(String), "MED_SAFETY", { link: "/patient/medications" });
  });

  it("stays silent when no concern involves the new med", async () => {
    findUnique.mockResolvedValue({ userId: "u1", allergies: [], prescriptions: [{ medication: "aspirin", dosage: "81mg" }] });
    chat.mockResolvedValue('{"interactions":[],"dosingNotes":[],"allergyConflicts":[],"overallNote":"ok"}');
    await checkNewPrescriptionSafety("pat1", "aspirin");
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("no-ops when the patient is missing", async () => {
    findUnique.mockResolvedValue(null);
    await checkNewPrescriptionSafety("nope", "x");
    expect(chat).not.toHaveBeenCalled();
    expect(createNotification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2:** Run `npx jest src/__tests__/lib/amelia/medsafety-newrx.test.ts` → FAIL.

- [ ] **Step 3: Append to `src/lib/amelia/medsafety.ts`**

```typescript

export async function checkNewPrescriptionSafety(patientId: string, newMedName: string): Promise<void> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: { prescriptions: { where: { isActive: true } } },
  });
  if (!patient) return;

  const meds: MedInput[] = patient.prescriptions.map((p) => ({ medication: p.medication, dosage: p.dosage }));
  const result = await analyzeMedications(meds, patient.allergies);

  const newLower = newMedName.toLowerCase();
  const involvesNew = (name: string) => {
    const n = name.toLowerCase();
    return n.includes(newLower) || newLower.includes(n);
  };
  const relevant =
    result.interactions.some(
      (i) => (i.severity === "high" || i.severity === "moderate") && i.drugs.some((d) => involvesNew(d))
    ) || result.allergyConflicts.some((c) => involvesNew(c.medication));

  if (relevant) {
    await createNotification(
      patient.userId,
      "Medication safety",
      "Amelia flagged a possible interaction with your new medication — review it.",
      "MED_SAFETY",
      { link: "/patient/medications" }
    );
  }
}
```

- [ ] **Step 4:** Run the test → PASS (3 tests). Then `npx tsc --noEmit -p .` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/medsafety.ts src/__tests__/lib/amelia/medsafety-newrx.test.ts
git commit -m "feat(amelia): notify patient on a risky new prescription (TDD)"
```

---

## Task 4: GET /api/amelia/med-safety (TDD)

**Files:**
- Create: `src/app/api/amelia/med-safety/route.ts`
- Test: `src/__tests__/api/amelia/med-safety.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/api/amelia/med-safety.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } } }));
jest.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: async () => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }) }));
const getCachedOrAnalyze = jest.fn();
jest.mock("@/lib/amelia/medsafety", () => ({ getCachedOrAnalyze: (...a: unknown[]) => getCachedOrAnalyze(...a) }));

import { GET } from "@/app/api/amelia/med-safety/route";
function req() { return new Request("http://localhost/api/amelia/med-safety") as never; }

beforeEach(() => [getUser, userFindUnique, getCachedOrAnalyze].forEach((m) => m.mockReset()));

describe("GET /api/amelia/med-safety", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET(req())).status).toBe(401);
  });

  it("returns the analysis for the patient's active meds", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1", allergies: ["penicillin"], prescriptions: [{ medication: "Aspirin", dosage: "81mg" }] } });
    getCachedOrAnalyze.mockResolvedValue({ interactions: [], dosingNotes: [], allergyConflicts: [], overallNote: "ok" });
    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.result.overallNote).toBe("ok");
    expect(getCachedOrAnalyze).toHaveBeenCalledWith("pat1", [{ medication: "Aspirin", dosage: "81mg" }], ["penicillin"]);
  });
});
```

- [ ] **Step 2:** Run `npx jest src/__tests__/api/amelia/med-safety.test.ts` → FAIL.

- [ ] **Step 3: Create `src/app/api/amelia/med-safety/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { getCachedOrAnalyze } from "@/lib/amelia/medsafety";

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    include: { patient: { include: { prescriptions: { where: { isActive: true } } } } },
  });
  if (!user?.patient) return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });

  const limit = await checkRateLimitAsync(`amelia:med-safety:${user.id}`);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  const meds = user.patient.prescriptions.map((p) => ({ medication: p.medication, dosage: p.dosage }));
  const result = await getCachedOrAnalyze(user.patient.id, meds, user.patient.allergies);
  return NextResponse.json({ result });
}
```

- [ ] **Step 4:** Run the test → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/amelia/med-safety/route.ts src/__tests__/api/amelia/med-safety.test.ts
git commit -m "feat(amelia): GET /api/amelia/med-safety (TDD)"
```

---

## Task 5: Prescription route hook (TDD)

**Files:**
- Modify: `src/app/api/prescriptions/route.ts`
- Test: `src/__tests__/api/amelia/prescriptions-hook.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/api/amelia/prescriptions-hook.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
const patientFindUnique = jest.fn();
const $transaction = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    patient: { findUnique: (...a: unknown[]) => patientFindUnique(...a) },
    $transaction: (...a: unknown[]) => $transaction(...a),
  },
}));
const checkNewPrescriptionSafety = jest.fn();
jest.mock("@/lib/amelia/medsafety", () => ({ checkNewPrescriptionSafety: (...a: unknown[]) => checkNewPrescriptionSafety(...a) }));

import { POST } from "@/app/api/prescriptions/route";
function req(body: unknown) { return new Request("http://localhost/api/prescriptions", { method: "POST", body: JSON.stringify(body) }) as never; }

beforeEach(() => [getUser, userFindUnique, patientFindUnique, $transaction, checkNewPrescriptionSafety].forEach((m) => m.mockReset()));

describe("POST /api/prescriptions med-safety hook", () => {
  it("calls checkNewPrescriptionSafety after a successful create", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", firstName: "A", lastName: "B", doctor: { id: "doc1" } });
    patientFindUnique.mockResolvedValue({ id: "pat1", userId: "pu1", user: {} });
    $transaction.mockResolvedValue({ prescription: { id: "rx1" }, notification: {} });
    checkNewPrescriptionSafety.mockResolvedValue(undefined);

    const res = await POST(req({ patientId: "pat1", medication: "Amoxicillin", dosage: "500mg", frequency: "TID", duration: "7 days" }));
    expect(res.status).toBe(201);
    expect(checkNewPrescriptionSafety).toHaveBeenCalledWith("pat1", "Amoxicillin");
  });
});
```

- [ ] **Step 2:** Run `npx jest src/__tests__/api/amelia/prescriptions-hook.test.ts` → FAIL (hook not called).

- [ ] **Step 3: Modify `src/app/api/prescriptions/route.ts`.** Add this import after the existing imports (after `import { createServerSupabaseClient } from "@/lib/supabase-server";`):

```typescript
import { checkNewPrescriptionSafety } from "@/lib/amelia/medsafety";
```

In the `POST` handler, after the `const result = await prisma.$transaction(...)` block closes (the line with `});` that ends the transaction, immediately before `return NextResponse.json(`), INSERT:

```typescript
    // Phase 2 med-coach: best-effort safety check on the new medication
    // (never block or break prescribing).
    try {
      await checkNewPrescriptionSafety(validated.patientId, validated.medication);
    } catch (safetyErr) {
      console.error("Medication safety check failed:", safetyErr);
    }
```

- [ ] **Step 4:** Run the test → PASS (1 test). Then `npx tsc --noEmit -p .` → no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/prescriptions/route.ts src/__tests__/api/amelia/prescriptions-hook.test.ts
git commit -m "feat(amelia): prescription route runs a best-effort med-safety check (TDD)"
```

---

## Task 6: MedSafetyPanel (TDD, jsdom)

**Files:**
- Create: `src/components/amelia/MedSafetyPanel.tsx`
- Test: `src/__tests__/components/amelia/MedSafetyPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/amelia/MedSafetyPanel.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import MedSafetyPanel from "@/components/amelia/MedSafetyPanel";

function mockFetch(result: unknown, ok = true) {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({ ok, json: async () => ({ result }) })) as unknown as jest.Mock;
}

beforeEach(() => mockFetch({ interactions: [], dosingNotes: [], allergyConflicts: [], overallNote: "Confirm with a professional." }));

describe("MedSafetyPanel", () => {
  it("shows the no-concerns state when clean", async () => {
    render(<MedSafetyPanel />);
    await waitFor(() => expect(screen.getByText(/No concerns found/i)).toBeInTheDocument());
    expect(screen.getByText(/Confirm with a professional/i)).toBeInTheDocument();
  });

  it("renders an interaction with its severity", async () => {
    mockFetch({ interactions: [{ drugs: ["aspirin", "warfarin"], severity: "high", note: "bleeding risk" }], dosingNotes: [], allergyConflicts: [], overallNote: "x" });
    render(<MedSafetyPanel />);
    await waitFor(() => expect(screen.getByText(/bleeding risk/)).toBeInTheDocument());
    expect(screen.getByText(/high interaction/i)).toBeInTheDocument();
  });

  it("shows an error state when the request fails", async () => {
    mockFetch({}, false);
    render(<MedSafetyPanel />);
    await waitFor(() => expect(screen.getByText(/unavailable/i)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2:** Run `npx jest src/__tests__/components/amelia/MedSafetyPanel.test.tsx` → FAIL.

- [ ] **Step 3: Create `src/components/amelia/MedSafetyPanel.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";

interface MedSafetyResult {
  interactions: { drugs: string[]; severity: string; note: string }[];
  dosingNotes: { medication: string; note: string }[];
  allergyConflicts: { medication: string; allergy: string; note: string }[];
  overallNote: string;
}

const SEVERITY_STYLE: Record<string, string> = {
  high: "bg-red-50 border-red-200 text-red-800",
  moderate: "bg-amber-50 border-amber-200 text-amber-800",
  low: "bg-gray-50 border-gray-200 text-gray-700",
};

export default function MedSafetyPanel() {
  const [result, setResult] = useState<MedSafetyResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/amelia/med-safety");
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          setResult(data.result);
          setState("ready");
        } else {
          setState("error");
        }
      } catch {
        if (active) setState("error");
      }
    })();
    return () => { active = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="mb-8 flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Amelia is reviewing your medications…
      </div>
    );
  }
  if (state === "error" || !result) {
    return <div className="mb-8 text-sm text-gray-400">Medication safety review is unavailable right now.</div>;
  }

  const hasConcerns = result.interactions.length > 0 || result.dosingNotes.length > 0 || result.allergyConflicts.length > 0;

  return (
    <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
        <h2 className="text-base font-semibold text-gray-900">Medication safety</h2>
      </div>
      {!hasConcerns ? (
        <p className="text-sm text-gray-500">No concerns found across your current medications.</p>
      ) : (
        <div className="space-y-2">
          {result.allergyConflicts.map((c, i) => (
            <div key={`a${i}`} className="rounded-xl border bg-red-50 border-red-200 text-red-800 px-3 py-2 text-sm">
              <span className="font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Allergy conflict: {c.medication}</span>
              <p className="mt-0.5">{c.note}</p>
            </div>
          ))}
          {result.interactions.map((it, i) => (
            <div key={`i${i}`} className={`rounded-xl border px-3 py-2 text-sm ${SEVERITY_STYLE[it.severity] ?? SEVERITY_STYLE.low}`}>
              <span className="font-medium capitalize">{it.severity} interaction: {it.drugs.join(" + ")}</span>
              <p className="mt-0.5">{it.note}</p>
            </div>
          ))}
          {result.dosingNotes.map((d, i) => (
            <div key={`d${i}`} className="rounded-xl border bg-gray-50 border-gray-200 text-gray-700 px-3 py-2 text-sm">
              <span className="font-medium">Dosing: {d.medication}</span>
              <p className="mt-0.5">{d.note}</p>
            </div>
          ))}
        </div>
      )}
      {result.overallNote && <p className="text-xs text-gray-400 mt-3">{result.overallNote}</p>}
    </section>
  );
}
```

- [ ] **Step 4:** Run the test → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/amelia/MedSafetyPanel.tsx src/__tests__/components/amelia/MedSafetyPanel.test.tsx
git commit -m "feat(amelia): MedSafetyPanel (TDD)"
```

---

## Task 7: Wire the panel into the medications page + verify

**Files:**
- Modify: `src/app/(patient)/patient/medications/page.tsx`

- [ ] **Step 1: Add the import.** In `src/app/(patient)/patient/medications/page.tsx`, after the existing import block (after the `date-fns` import line `import { format, formatDistanceToNow } from "date-fns";`), add:

```typescript
import MedSafetyPanel from "@/components/amelia/MedSafetyPanel";
```

- [ ] **Step 2: Render the panel.** Find the main content opening tag (it reads exactly):

```tsx
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
```

Immediately AFTER that line, insert:

```tsx
        <MedSafetyPanel />
```

- [ ] **Step 3: Verify build + full test run**

Run: `npx tsc --noEmit -p . && npm test`
Expected: tsc clean; all suites pass.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(patient)/patient/medications/page.tsx"
git commit -m "feat(amelia): surface the medication safety panel on the meds page"
```

---

## Task 8: End-of-phase verification + tag

**Files:** none (verification + ops)

- [ ] **Step 1: Full quality gate**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: tsc clean; all tests pass; production build succeeds.

- [ ] **Step 2: Manual smoke** (valid `OPENAI_API_KEY` + DB up, as the seeded patient): open `/patient/medications` → the "Medication safety" panel appears (loading → result). Seed the patient with an allergy that matches a med (e.g. allergy "penicillin" + a penicillin-class med) → expect an allergy-conflict card. As a doctor, prescribe a drug that interacts with an existing one → the patient gets a "Medication safety" notification.

- [ ] **Step 3: Update the graph** — Run: `graphify update "C:\Users\IKA\Nala Vita"`.

- [ ] **Step 4: Tag** — `git tag amelia-phase-2-medcoach-complete`.

---

## Self-Review Coverage Map (spec → task)

| Spec requirement | Task |
|---|---|
| `MedSafetyResult` shape + `medListHash` + `exactAllergyMatches` | 1 |
| `analyzeMedications` (gpt-4o + deterministic merge) + `getCachedOrAnalyze` (in-memory cache) | 2 |
| `checkNewPrescriptionSafety` (notify on new-med high/moderate concern) | 3 |
| `GET /api/amelia/med-safety` (auth, rate-limited, patient-scoped) | 4 |
| `POST /api/prescriptions` best-effort hook | 5 |
| `MedSafetyPanel` (auto-fetch, severities, loading/empty/error) | 6 |
| Panel surfaced on the meds page | 7 |

**Deferred (per spec §9):** external drug DB / RxNorm, persisted cache, doctor-facing safety (Phase 3), per-warning acknowledgement; lab-photo OCR (separate sub-project).
