# Amelia Phase 2 — Long-Term Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Amelia long-term memory — she extracts durable facts from chats (gpt-4o-mini), recalls them in future turns (grounded in the prompt), and the patient curates them in a "What Amelia knows" panel, with a hybrid-by-stakes trust model.

**Architecture:** Extends the Phase 1 `src/lib/amelia/` engine. A new `memory.ts` handles extraction/recall/CRUD against a new `AmeliaMemory` table. The engine *reads* memory into the prompt; the chat route *writes* memory after each turn. A new panel + 3 API routes let the patient confirm/edit/delete. Low-stakes facts are used immediately; high-stakes facts (allergy/condition/medication) stay "to confirm" until the patient approves.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma (PostgreSQL), OpenAI (gpt-4o + gpt-4o-mini), Zod, Jest (node + jsdom).

**Spec:** `docs/superpowers/specs/2026-06-09-amelia-phase-2-memory-design.md`

---

## File Structure

**Create:**
- `src/lib/amelia/memory.ts` — extraction, recall, dedupe, CRUD (patient-scoped)
- `src/app/api/amelia/memory/route.ts` — `GET` list
- `src/app/api/amelia/memory/[id]/route.ts` — `PATCH` (confirm/edit) + `DELETE`
- `src/components/amelia/AmeliaMemoryPanel.tsx` — the curation panel
- `src/components/amelia/AmeliaTabs.tsx` — client two-tab wrapper (Chat | What Amelia knows)
- Tests under `src/__tests__/lib/amelia/`, `src/__tests__/api/amelia/`, `src/__tests__/components/amelia/`

**Modify:**
- `prisma/schema.prisma` — add `AmeliaMemory` model
- `src/lib/amelia/types.ts` — add `MemoryKind`, `MemoryCandidate`, `AmeliaMemoryFact`, `GroundingMemories`
- `src/lib/amelia/llm.ts` — add `model?` to `chat()` opts
- `src/lib/amelia/prompts.ts` — `patientAdvisorPrompt(ctx, memories?)` + `renderMemories()`
- `src/lib/amelia/engine.ts` — load grounding memories, pass to prompt
- `src/app/api/amelia/chat/route.ts` — extract + save memories after the reply
- `src/app/(patient)/patient/amelia/page.tsx` — render `<AmeliaTabs />`
- `src/__tests__/lib/amelia/engine.test.ts` — mock `memory` (engine now reads it)
- `src/__tests__/api/amelia/chat.test.ts` — mock `memory` (route now writes it)

---

## Task 0: Branch + baseline

- [ ] **Step 1: Create feature branch**

```bash
cd "C:/Users/IKA/Nala Vita"
git checkout -b feat/amelia-phase-2-memory
```

- [ ] **Step 2: Confirm baseline green**

Run: `npx tsc --noEmit -p . && npm test`
Expected: tsc clean; all Phase 1 Amelia suites pass.

---

## Task 1: AmeliaMemory model

**Files:** Modify `prisma/schema.prisma` (append one model)

- [ ] **Step 1: Append the model to the end of `prisma/schema.prisma`**

```prisma
model AmeliaMemory {
  id              String   @id @default(cuid())
  patientId       String   @map("patient_id")
  kind            String   // ALLERGY | CONDITION | MEDICATION | PREFERENCE | LIFESTYLE | OTHER
  value           String
  confirmedByUser Boolean  @default(false) @map("confirmed_by_user")
  sourceMessageId String?  @map("source_message_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@index([patientId])
  @@map("amelia_memories")
}
```

- [ ] **Step 2: Validate + generate** (offline; do NOT `db push` — Supabase is down)

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema is valid" + "Generated Prisma Client".

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(amelia): add AmeliaMemory model"
```

---

## Task 2: Memory types

**Files:** Modify `src/lib/amelia/types.ts` (append)

- [ ] **Step 1: Append these types to the end of `src/lib/amelia/types.ts`**

```typescript
export type MemoryKind = "ALLERGY" | "CONDITION" | "MEDICATION" | "PREFERENCE" | "LIFESTYLE" | "OTHER";

export interface MemoryCandidate {
  kind: MemoryKind;
  value: string;
}

export interface AmeliaMemoryFact {
  id: string;
  kind: MemoryKind;
  value: string;
  confirmedByUser: boolean;
}

export interface GroundingMemories {
  known: AmeliaMemoryFact[];
  toConfirm: AmeliaMemoryFact[];
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/amelia/types.ts
git commit -m "feat(amelia): memory types"
```

---

## Task 3: llm.ts model override (prerequisite for cheap extraction)

**Files:** Modify `src/lib/amelia/llm.ts`

- [ ] **Step 1: Add a `model?` option.** Replace the `chat` function body's options handling. The full new file:

```typescript
// src/lib/amelia/llm.ts
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(
  messages: ChatTurn[],
  opts?: { temperature?: number; maxTokens?: number; model?: string }
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: opts?.model ?? "gpt-4o",
    messages,
    temperature: opts?.temperature ?? 0.4,
    max_tokens: opts?.maxTokens ?? 800,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}
```

- [ ] **Step 2: Verify existing tests still pass** (the lab-summary + engine tests use `chat`)

Run: `npx tsc --noEmit -p . && npx jest src/__tests__/lib/amelia/engine.test.ts`
Expected: tsc clean; engine test still passes (the new optional param is backward-compatible).

- [ ] **Step 3: Commit**

```bash
git add src/lib/amelia/llm.ts
git commit -m "feat(amelia): allow model override in llm.chat (for gpt-4o-mini extraction)"
```

---

## Task 4: Memory extraction + classifier (TDD)

**Files:**
- Create: `src/lib/amelia/memory.ts` (first half — `isHighStakes`, `extractMemories`)
- Test: `src/__tests__/lib/amelia/memory-extract.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/memory-extract.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const chat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));

import { isHighStakes, extractMemories } from "@/lib/amelia/memory";

beforeEach(() => chat.mockReset());

describe("isHighStakes", () => {
  it("flags medical kinds as high-stakes", () => {
    expect(isHighStakes("ALLERGY")).toBe(true);
    expect(isHighStakes("CONDITION")).toBe(true);
    expect(isHighStakes("MEDICATION")).toBe(true);
  });
  it("treats preferences/lifestyle as low-stakes", () => {
    expect(isHighStakes("PREFERENCE")).toBe(false);
    expect(isHighStakes("LIFESTYLE")).toBe(false);
    expect(isHighStakes("OTHER")).toBe(false);
  });
});

describe("extractMemories", () => {
  it("parses a JSON array of valid candidates", async () => {
    chat.mockResolvedValue('[{"kind":"ALLERGY","value":"penicillin"},{"kind":"PREFERENCE","value":"prefers morning appointments"}]');
    const out = await extractMemories("I am allergic to penicillin", "Noted.");
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ kind: "ALLERGY", value: "penicillin" });
  });

  it("strips code fences and drops invalid entries", async () => {
    chat.mockResolvedValue('```json\n[{"kind":"NOPE","value":"x"},{"kind":"CONDITION","value":"type 2 diabetes"}]\n```');
    const out = await extractMemories("...", "...");
    expect(out).toEqual([{ kind: "CONDITION", value: "type 2 diabetes" }]);
  });

  it("returns [] when the model returns non-JSON", async () => {
    chat.mockResolvedValue("I could not find anything.");
    expect(await extractMemories("hi", "hello")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/memory-extract.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/amelia/memory.ts` with this content**

```typescript
// src/lib/amelia/memory.ts
import { prisma } from "@/lib/prisma";
import { chat } from "./llm";
import type { MemoryKind, MemoryCandidate, AmeliaMemoryFact, GroundingMemories } from "./types";

const HIGH_STAKES: MemoryKind[] = ["ALLERGY", "CONDITION", "MEDICATION"];
const VALID_KINDS: MemoryKind[] = ["ALLERGY", "CONDITION", "MEDICATION", "PREFERENCE", "LIFESTYLE", "OTHER"];

export function isHighStakes(kind: string): boolean {
  return HIGH_STAKES.includes(kind as MemoryKind);
}

export async function extractMemories(userText: string, assistantText: string): Promise<MemoryCandidate[]> {
  const raw = await chat(
    [
      {
        role: "system",
        content:
          'Extract durable, long-term facts about the patient from the exchange. Return ONLY a JSON array (no prose, no code fences) of objects {"kind","value"} where kind is one of ALLERGY, CONDITION, MEDICATION, PREFERENCE, LIFESTYLE, OTHER. Only include stable facts worth remembering across visits (chronic conditions, allergies, long-term medications, durable preferences). Do NOT include transient symptoms, one-off questions, or anything uncertain. If nothing qualifies, return [].',
      },
      { role: "user", content: `Patient said: ${userText}\nAmelia replied: ${assistantText}` },
    ],
    { model: "gpt-4o-mini", temperature: 0, maxTokens: 300 }
  );

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (c): c is MemoryCandidate =>
        !!c && typeof c === "object" &&
        typeof (c as { value?: unknown }).value === "string" &&
        VALID_KINDS.includes((c as { kind?: MemoryKind }).kind as MemoryKind)
    )
    .map((c) => ({ kind: c.kind, value: c.value.trim() }))
    .filter((c) => c.value.length > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/memory-extract.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/memory.ts src/__tests__/lib/amelia/memory-extract.test.ts
git commit -m "feat(amelia): memory extraction + stakes classifier (TDD)"
```

---

## Task 5: Save + recall memories (TDD, mocked Prisma)

**Files:**
- Modify: `src/lib/amelia/memory.ts` (append `saveMemories`, `getMemoriesForGrounding`)
- Test: `src/__tests__/lib/amelia/memory-store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/memory-store.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findMany = jest.fn();
const createMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { ameliaMemory: { findMany: (...a: unknown[]) => findMany(...a), createMany: (...a: unknown[]) => createMany(...a) } },
}));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));

import { saveMemories, getMemoriesForGrounding } from "@/lib/amelia/memory";

beforeEach(() => { findMany.mockReset(); createMany.mockReset(); });

describe("saveMemories", () => {
  it("dedupes and sets confirmedByUser by stakes", async () => {
    findMany.mockResolvedValue([{ kind: "ALLERGY", value: "penicillin" }]);
    createMany.mockResolvedValue({ count: 2 });
    await saveMemories("pat1", [
      { kind: "ALLERGY", value: "Penicillin" },        // dupe (case-insensitive) -> skipped
      { kind: "CONDITION", value: "asthma" },          // high-stakes -> confirmed false
      { kind: "PREFERENCE", value: "morning visits" }, // low-stakes -> confirmed true
    ], "msg1");
    expect(createMany).toHaveBeenCalledTimes(1);
    const rows = (createMany.mock.calls[0][0] as { data: { kind: string; confirmedByUser: boolean }[] }).data;
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.kind === "CONDITION")!.confirmedByUser).toBe(false);
    expect(rows.find((r) => r.kind === "PREFERENCE")!.confirmedByUser).toBe(true);
  });

  it("no-ops when nothing fresh", async () => {
    findMany.mockResolvedValue([{ kind: "CONDITION", value: "asthma" }]);
    await saveMemories("pat1", [{ kind: "CONDITION", value: "asthma" }]);
    expect(createMany).not.toHaveBeenCalled();
  });
});

describe("getMemoriesForGrounding", () => {
  it("splits known vs toConfirm by stakes + confirmation", async () => {
    findMany.mockResolvedValue([
      { id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: false },   // high + unconfirmed -> toConfirm
      { id: "2", kind: "ALLERGY", value: "sulfa", confirmedByUser: true },          // high + confirmed -> known
      { id: "3", kind: "PREFERENCE", value: "mornings", confirmedByUser: false },   // low -> known
    ]);
    const out = await getMemoriesForGrounding("pat1");
    expect(out.toConfirm.map((m) => m.id)).toEqual(["1"]);
    expect(out.known.map((m) => m.id).sort()).toEqual(["2", "3"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/memory-store.test.ts`
Expected: FAIL — `saveMemories`/`getMemoriesForGrounding` not exported.

- [ ] **Step 3: Append to `src/lib/amelia/memory.ts`**

```typescript

export async function saveMemories(
  patientId: string,
  candidates: MemoryCandidate[],
  sourceMessageId?: string
): Promise<void> {
  if (candidates.length === 0) return;
  const existing = await prisma.ameliaMemory.findMany({ where: { patientId }, select: { kind: true, value: true } });
  const seen = new Set(existing.map((e) => `${e.kind}::${e.value.toLowerCase()}`));
  const fresh = candidates.filter((c) => !seen.has(`${c.kind}::${c.value.toLowerCase()}`));
  if (fresh.length === 0) return;
  await prisma.ameliaMemory.createMany({
    data: fresh.map((c) => ({
      patientId,
      kind: c.kind,
      value: c.value,
      confirmedByUser: !isHighStakes(c.kind),
      sourceMessageId: sourceMessageId ?? null,
    })),
  });
}

export async function getMemoriesForGrounding(patientId: string): Promise<GroundingMemories> {
  const all = await prisma.ameliaMemory.findMany({ where: { patientId }, orderBy: { createdAt: "desc" } });
  const known: AmeliaMemoryFact[] = [];
  const toConfirm: AmeliaMemoryFact[] = [];
  for (const m of all) {
    const fact: AmeliaMemoryFact = { id: m.id, kind: m.kind as MemoryKind, value: m.value, confirmedByUser: m.confirmedByUser };
    if (!isHighStakes(m.kind) || m.confirmedByUser) known.push(fact);
    else toConfirm.push(fact);
  }
  return { known, toConfirm };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/memory-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/memory.ts src/__tests__/lib/amelia/memory-store.test.ts
git commit -m "feat(amelia): save (dedupe + stakes) and recall memories (TDD)"
```

---

## Task 6: Panel CRUD operations (TDD, mocked Prisma)

**Files:**
- Modify: `src/lib/amelia/memory.ts` (append `listMemories`, `confirmMemory`, `updateMemory`, `deleteMemory`)
- Test: `src/__tests__/lib/amelia/memory-crud.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/memory-crud.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findMany = jest.fn();
const updateMany = jest.fn();
const deleteMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { ameliaMemory: {
    findMany: (...a: unknown[]) => findMany(...a),
    updateMany: (...a: unknown[]) => updateMany(...a),
    deleteMany: (...a: unknown[]) => deleteMany(...a),
  } },
}));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));

import { listMemories, confirmMemory, updateMemory, deleteMemory } from "@/lib/amelia/memory";

beforeEach(() => { findMany.mockReset(); updateMany.mockReset(); deleteMany.mockReset(); });

describe("memory CRUD (patient-scoped)", () => {
  it("lists memories as facts", async () => {
    findMany.mockResolvedValue([{ id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: true }]);
    const out = await listMemories("pat1");
    expect(out).toEqual([{ id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: true }]);
  });

  it("confirm/update/delete are scoped by both id AND patientId", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    deleteMany.mockResolvedValue({ count: 1 });
    await confirmMemory("m1", "pat1");
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "m1", patientId: "pat1" }, data: { confirmedByUser: true } });
    await updateMemory("m1", "pat1", "new value");
    expect(updateMany).toHaveBeenLastCalledWith({ where: { id: "m1", patientId: "pat1" }, data: { value: "new value" } });
    await deleteMemory("m1", "pat1");
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: "m1", patientId: "pat1" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/memory-crud.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Append to `src/lib/amelia/memory.ts`**

```typescript

export async function listMemories(patientId: string): Promise<AmeliaMemoryFact[]> {
  const all = await prisma.ameliaMemory.findMany({
    where: { patientId },
    orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
  });
  return all.map((m) => ({ id: m.id, kind: m.kind as MemoryKind, value: m.value, confirmedByUser: m.confirmedByUser }));
}

export async function confirmMemory(id: string, patientId: string): Promise<void> {
  await prisma.ameliaMemory.updateMany({ where: { id, patientId }, data: { confirmedByUser: true } });
}

export async function updateMemory(id: string, patientId: string, value: string): Promise<void> {
  await prisma.ameliaMemory.updateMany({ where: { id, patientId }, data: { value } });
}

export async function deleteMemory(id: string, patientId: string): Promise<void> {
  await prisma.ameliaMemory.deleteMany({ where: { id, patientId } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/memory-crud.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/memory.ts src/__tests__/lib/amelia/memory-crud.test.ts
git commit -m "feat(amelia): patient-scoped memory CRUD (TDD)"
```

---

## Task 7: Inject memory into the prompt (TDD)

**Files:**
- Modify: `src/lib/amelia/prompts.ts`
- Test: `src/__tests__/lib/amelia/prompts-memory.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/prompts-memory.test.ts
import { describe, it, expect } from "@jest/globals";
import { patientAdvisorPrompt } from "@/lib/amelia/prompts";
import type { AmeliaContext, GroundingMemories } from "@/lib/amelia/types";

const ctx: AmeliaContext = {
  firstName: "Ada", age: 34, gender: "female", allergies: [], activeMedications: [], recentVitals: [], recentLabs: [],
};

describe("patientAdvisorPrompt with memory", () => {
  it("includes known facts and a to-confirm block", () => {
    const mem: GroundingMemories = {
      known: [{ id: "1", kind: "PREFERENCE", value: "prefers mornings", confirmedByUser: false }],
      toConfirm: [{ id: "2", kind: "ALLERGY", value: "penicillin", confirmedByUser: false }],
    };
    const p = patientAdvisorPrompt(ctx, mem);
    expect(p).toMatch(/KNOWN ABOUT THIS PATIENT/);
    expect(p).toMatch(/prefers mornings/);
    expect(p).toMatch(/TO GENTLY CONFIRM/);
    expect(p).toMatch(/penicillin/);
    expect(p).toMatch(/do NOT rely on/i);
  });

  it("omits the to-confirm block when there is nothing to confirm", () => {
    const mem: GroundingMemories = { known: [], toConfirm: [] };
    const p = patientAdvisorPrompt(ctx, mem);
    expect(p).not.toMatch(/TO GENTLY CONFIRM/);
  });

  it("still works with no memory argument (Phase 1 behavior)", () => {
    expect(patientAdvisorPrompt(ctx)).toMatch(/Amelia/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/prompts-memory.test.ts`
Expected: FAIL — `patientAdvisorPrompt` takes one arg / no memory block.

- [ ] **Step 3: Replace the full `src/lib/amelia/prompts.ts`** (keeps `renderContext` unchanged, adds `renderMemories`, extends `patientAdvisorPrompt`)

```typescript
import type { AmeliaContext, GroundingMemories } from "./types";

export function renderContext(ctx: AmeliaContext): string {
  const meds = ctx.activeMedications.length
    ? ctx.activeMedications.map((m) => `${m.medication} ${m.dosage} ${m.frequency}`).join("; ")
    : "none on record";
  const allergies = ctx.allergies.length ? ctx.allergies.join(", ") : "none on record";
  const v = ctx.recentVitals[0];
  const vitals = v
    ? `BP ${v.bloodPressure ?? "?"}, HR ${v.heartRate ?? "?"}, SpO2 ${v.oxygenSaturation ?? "?"}, glucose ${v.bloodSugar ?? "?"} (recorded ${v.recordedAt})`
    : "none on record";
  const labs = ctx.recentLabs.length
    ? ctx.recentLabs.map((l) => `${l.testName}: ${l.resultValue}${l.unit ? " " + l.unit : ""}${l.isAbnormal ? " (abnormal)" : ""}`).join("; ")
    : "none on record";

  return [
    `Patient: ${ctx.firstName}${ctx.age != null ? `, age ${ctx.age}` : ""}${ctx.gender ? `, ${ctx.gender}` : ""}.`,
    `Known allergies: ${allergies}.`,
    `Active medications: ${meds}.`,
    `Most recent vitals: ${vitals}.`,
    `Recent labs: ${labs}.`,
  ].join("\n");
}

export function renderMemories(memories: GroundingMemories): string {
  const known = memories.known.length
    ? memories.known.map((m) => `- ${m.kind}: ${m.value}`).join("\n")
    : "- (nothing remembered yet)";
  let out = `\n\nKNOWN ABOUT THIS PATIENT (from memory — treat as fact):\n${known}`;
  if (memories.toConfirm.length) {
    const tc = memories.toConfirm.map((m) => `- ${m.kind}: ${m.value}`).join("\n");
    out += `\n\nTO GENTLY CONFIRM (do NOT rely on these until the patient confirms — raise them softly in conversation and point the patient to the "What Amelia knows" panel to confirm):\n${tc}`;
  }
  return out;
}

export function patientAdvisorPrompt(ctx: AmeliaContext, memories?: GroundingMemories): string {
  const memBlock = memories ? renderMemories(memories) : "";
  return `You are Amelia, a warm, careful AI health assistant on the Nala Vita platform.

You are speaking directly to a patient who may not have a doctor. Your role is "Advisor":
- Explain symptoms in plain, reassuring language.
- You MAY name likely possible conditions ("this could be X, Y, or Z"), recommend over-the-counter remedies and self-care, and interpret lab/vital values.
- You MUST NOT prescribe prescription-only medication or give a definitive diagnosis.
- ALWAYS close by recommending the patient confirm with a doctor, and offer to help them book one.
- If the patient describes a possible emergency, your FIRST priority is to tell them to seek emergency care immediately.
- Use the patient's real data below to ground every answer. Never invent medications, allergies, or results that are not listed.

PATIENT CONTEXT (real data from their record):
${renderContext(ctx)}${memBlock}

Keep replies concise, kind, and structured. Be honest about urgency without being alarmist.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/prompts-memory.test.ts src/__tests__/lib/amelia/prompts.test.ts`
Expected: PASS (new 3 + existing prompts tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/prompts.ts src/__tests__/lib/amelia/prompts-memory.test.ts
git commit -m "feat(amelia): inject known + to-confirm memory blocks into the prompt (TDD)"
```

---

## Task 8: Engine reads memory (TDD — update existing engine test)

**Files:**
- Modify: `src/lib/amelia/engine.ts`
- Modify: `src/__tests__/lib/amelia/engine.test.ts` (add a `memory` mock + an assertion)

- [ ] **Step 1: Update the engine test.** At the top of `src/__tests__/lib/amelia/engine.test.ts`, add a mock for the memory module alongside the existing mocks, and add an assertion that grounding memory is loaded. Add these lines after the existing `jest.mock("@/lib/amelia/llm", ...)` line:

```typescript
const getMemoriesForGrounding = jest.fn();
jest.mock("@/lib/amelia/memory", () => ({ getMemoriesForGrounding: (...a: unknown[]) => getMemoriesForGrounding(...a) }));
```

Then, in the existing `beforeEach`, add `getMemoriesForGrounding.mockReset();` and a default return so the non-emergency test works. Update the `beforeEach` block to:

```typescript
beforeEach(() => {
  getPatientContext.mockReset();
  chat.mockReset();
  getMemoriesForGrounding.mockReset();
  getMemoriesForGrounding.mockResolvedValue({ known: [], toConfirm: [] });
});
```

In the "grounds a normal turn" test, after the existing `expect(getPatientContext).toHaveBeenCalledWith("p1");` line, add:

```typescript
    expect(getMemoriesForGrounding).toHaveBeenCalledWith("p1");
```

In the emergency test, add after `expect(getPatientContext).not.toHaveBeenCalled();`:

```typescript
    expect(getMemoriesForGrounding).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/engine.test.ts`
Expected: FAIL — engine doesn't call `getMemoriesForGrounding` yet.

- [ ] **Step 3: Update `src/lib/amelia/engine.ts`.** Full new file:

```typescript
// src/lib/amelia/engine.ts
import { getPatientContext } from "./context";
import { getMemoriesForGrounding } from "./memory";
import { patientAdvisorPrompt } from "./prompts";
import { detectRedFlags, urgencyFromRedFlags, PATIENT_DISCLAIMER, EMERGENCY_MESSAGE } from "./safety";
import { chat, type ChatTurn } from "./llm";
import type { AmeliaTurnInput, AmeliaReply } from "./types";

export async function runAmeliaTurn(input: AmeliaTurnInput): Promise<AmeliaReply> {
  const latestUser = [...input.messages].reverse().find((m) => m.role === "user");
  const redFlags = latestUser ? detectRedFlags(latestUser.content) : [];

  // Emergency short-circuit — deterministic, no LLM call, no data load.
  if (redFlags.length > 0) {
    return { content: EMERGENCY_MESSAGE, urgency: "emergency", redFlags, disclaimer: PATIENT_DISCLAIMER };
  }

  const [ctx, memories] = await Promise.all([
    getPatientContext(input.patientId),
    getMemoriesForGrounding(input.patientId),
  ]);

  const turns: ChatTurn[] = [
    { role: "system", content: patientAdvisorPrompt(ctx, memories) },
    ...input.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const content = await chat(turns);

  return { content, urgency: urgencyFromRedFlags(redFlags), redFlags, disclaimer: PATIENT_DISCLAIMER };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/engine.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/engine.ts src/__tests__/lib/amelia/engine.test.ts
git commit -m "feat(amelia): engine grounds replies in long-term memory (TDD)"
```

---

## Task 9: Chat route writes memory (TDD — update existing route test)

**Files:**
- Modify: `src/app/api/amelia/chat/route.ts`
- Modify: `src/__tests__/api/amelia/chat.test.ts` (mock `memory`, assert extraction called)

- [ ] **Step 1: Update the route test.** In `src/__tests__/api/amelia/chat.test.ts`, add a memory-module mock after the engine mock:

```typescript
const extractMemories = jest.fn();
const saveMemories = jest.fn();
jest.mock("@/lib/amelia/memory", () => ({
  extractMemories: (...a: unknown[]) => extractMemories(...a),
  saveMemories: (...a: unknown[]) => saveMemories(...a),
}));
```

Add both to the `beforeEach` reset list, and give them safe defaults inside `beforeEach`:

```typescript
  extractMemories.mockReset();
  saveMemories.mockReset();
  extractMemories.mockResolvedValue([{ kind: "PREFERENCE", value: "mornings" }]);
  saveMemories.mockResolvedValue(undefined);
```

In the happy-path test, after asserting the reply, add:

```typescript
    expect(extractMemories).toHaveBeenCalledTimes(1);
    expect(saveMemories).toHaveBeenCalledTimes(1);
```

Also ensure the user-message `create` mock returns an id. Change the existing `msgCreate.mockResolvedValue({})` to `msgCreate.mockResolvedValue({ id: "um1" })`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/amelia/chat.test.ts`
Expected: FAIL — route doesn't call extract/save yet.

- [ ] **Step 3: Update `src/app/api/amelia/chat/route.ts`.** Add the import and the post-reply extraction. Change the import block to add memory:

```typescript
import { runAmeliaTurn } from "@/lib/amelia/engine";
import { extractMemories, saveMemories } from "@/lib/amelia/memory";
import { logAmeliaAudit } from "@/lib/amelia/audit";
```

Capture the user message id — change line 40 from:

```typescript
    await prisma.ameliaMessage.create({ data: { conversationId: convo.id, role: "user", content: message } });
```

to:

```typescript
    const userMsg = await prisma.ameliaMessage.create({ data: { conversationId: convo.id, role: "user", content: message } });
```

Then, after the `await prisma.ameliaMessage.create(... role: "assistant" ...)` line and before `logAmeliaAudit`, insert:

```typescript
    // Phase 2: extract + persist durable memories from this exchange (best-effort;
    // never let memory failure break the chat response).
    try {
      const candidates = await extractMemories(message, reply.content);
      await saveMemories(user.patient.id, candidates, userMsg.id);
    } catch (memErr) {
      console.error("Amelia memory extraction failed:", memErr);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/api/amelia/chat.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/amelia/chat/route.ts src/__tests__/api/amelia/chat.test.ts
git commit -m "feat(amelia): chat route extracts + saves memory after each turn (TDD)"
```

---

## Task 10: Memory API routes (TDD)

**Files:**
- Create: `src/app/api/amelia/memory/route.ts` (GET list)
- Create: `src/app/api/amelia/memory/[id]/route.ts` (PATCH confirm/edit, DELETE)
- Test: `src/__tests__/api/amelia/memory.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/api/amelia/memory.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } } }));
const listMemories = jest.fn();
const confirmMemory = jest.fn();
const updateMemory = jest.fn();
const deleteMemory = jest.fn();
jest.mock("@/lib/amelia/memory", () => ({
  listMemories: (...a: unknown[]) => listMemories(...a),
  confirmMemory: (...a: unknown[]) => confirmMemory(...a),
  updateMemory: (...a: unknown[]) => updateMemory(...a),
  deleteMemory: (...a: unknown[]) => deleteMemory(...a),
}));

import { GET } from "@/app/api/amelia/memory/route";
import { PATCH, DELETE } from "@/app/api/amelia/memory/[id]/route";

function req(body?: unknown) {
  return new Request("http://localhost/api/amelia/memory", { method: "POST", body: body ? JSON.stringify(body) : undefined }) as never;
}
const ctx = (id: string) => ({ params: { id } });

beforeEach(() => [getUser, userFindUnique, listMemories, confirmMemory, updateMemory, deleteMemory].forEach((m) => m.mockReset()));

describe("memory API", () => {
  it("GET 401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("GET returns the patient's memories", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    listMemories.mockResolvedValue([{ id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: true }]);
    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.memories[0].value).toBe("penicillin");
    expect(listMemories).toHaveBeenCalledWith("pat1");
  });

  it("PATCH confirm calls confirmMemory scoped to the patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    confirmMemory.mockResolvedValue(undefined);
    const res = await PATCH(req({ action: "confirm" }), ctx("m1"));
    expect(res.status).toBe(200);
    expect(confirmMemory).toHaveBeenCalledWith("m1", "pat1");
  });

  it("DELETE removes the memory scoped to the patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    deleteMemory.mockResolvedValue(undefined);
    const res = await DELETE(req(), ctx("m1"));
    expect(res.status).toBe(200);
    expect(deleteMemory).toHaveBeenCalledWith("m1", "pat1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/amelia/memory.test.ts`
Expected: FAIL — route modules not found.

- [ ] **Step 3: Create `src/app/api/amelia/memory/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { listMemories } from "@/lib/amelia/memory";

export async function GET(_req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
  if (!user?.patient) return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });

  const memories = await listMemories(user.patient.id);
  return NextResponse.json({ memories });
}
```

- [ ] **Step 4: Create `src/app/api/amelia/memory/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { confirmMemory, updateMemory, deleteMemory } from "@/lib/amelia/memory";

const patchSchema = z.union([
  z.object({ action: z.literal("confirm") }),
  z.object({ value: z.string().min(1).max(500) }),
]);

async function getPatientId(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
  return user?.patient?.id ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = patchSchema.parse(await req.json());
    if ("action" in body) {
      await confirmMemory(params.id, patientId);
    } else {
      await updateMemory(params.id, patientId, body.value);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Memory PATCH error:", error);
    return NextResponse.json({ error: "Failed to update memory." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const patientId = await getPatientId();
  if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await deleteMemory(params.id, patientId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/api/amelia/memory.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/amelia/memory/route.ts "src/app/api/amelia/memory/[id]/route.ts" src/__tests__/api/amelia/memory.test.ts
git commit -m "feat(amelia): memory API routes — list, confirm/edit, delete (TDD)"
```

---

## Task 11: "What Amelia knows" panel (TDD, jsdom)

**Files:**
- Create: `src/components/amelia/AmeliaMemoryPanel.tsx`
- Test: `src/__tests__/components/amelia/AmeliaMemoryPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/amelia/AmeliaMemoryPanel.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AmeliaMemoryPanel from "@/components/amelia/AmeliaMemoryPanel";

function mockFetchSequence() {
  const calls: { url: string; method: string }[] = [];
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async (url: string, opts?: { method?: string }) => {
    calls.push({ url, method: opts?.method ?? "GET" });
    if ((opts?.method ?? "GET") === "GET") {
      return { ok: true, json: async () => ({ memories: [
        { id: "1", kind: "ALLERGY", value: "penicillin", confirmedByUser: false },
        { id: "2", kind: "PREFERENCE", value: "morning visits", confirmedByUser: true },
      ] }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  }) as unknown as jest.Mock;
  return calls;
}

beforeEach(() => mockFetchSequence());

describe("AmeliaMemoryPanel", () => {
  it("loads and lists memories with a Confirm button on the pending high-stakes item", async () => {
    render(<AmeliaMemoryPanel />);
    await waitFor(() => expect(screen.getByText("penicillin")).toBeInTheDocument());
    expect(screen.getByText("morning visits")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm/i })).toBeInTheDocument();
  });

  it("confirming a memory PATCHes it", async () => {
    const calls = mockFetchSequence();
    render(<AmeliaMemoryPanel />);
    await waitFor(() => expect(screen.getByText("penicillin")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    await waitFor(() => expect(calls.some((c) => c.method === "PATCH" && c.url.includes("/api/amelia/memory/1"))).toBe(true));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/components/amelia/AmeliaMemoryPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/amelia/AmeliaMemoryPanel.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Trash2, Loader2 } from "lucide-react";

interface MemoryFact {
  id: string;
  kind: string;
  value: string;
  confirmedByUser: boolean;
}

const HIGH_STAKES = new Set(["ALLERGY", "CONDITION", "MEDICATION"]);
const KIND_LABEL: Record<string, string> = {
  ALLERGY: "Allergies",
  CONDITION: "Conditions",
  MEDICATION: "Medications",
  PREFERENCE: "Preferences",
  LIFESTYLE: "Lifestyle",
  OTHER: "Other",
};

export default function AmeliaMemoryPanel() {
  const [memories, setMemories] = useState<MemoryFact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/amelia/memory");
      const data = await res.json();
      if (res.ok) setMemories(data.memories ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirm = async (id: string) => {
    await fetch(`/api/amelia/memory/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    await load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/amelia/memory/${id}`, { method: "DELETE" });
    await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (memories.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-12 px-4">
        Amelia hasn&apos;t learned anything yet — chat with her and she&apos;ll start remembering.
      </div>
    );
  }

  const groups = Object.keys(KIND_LABEL)
    .map((kind) => ({ kind, items: memories.filter((m) => m.kind === kind) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="overflow-y-auto px-4 py-4 space-y-6">
      {groups.map((g) => (
        <div key={g.kind}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{KIND_LABEL[g.kind]}</h3>
          <ul className="space-y-2">
            {g.items.map((m) => {
              const pending = HIGH_STAKES.has(m.kind) && !m.confirmedByUser;
              return (
                <li key={m.id} className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-2">
                  <span className="flex-1 text-sm text-gray-800">{m.value}</span>
                  {pending ? (
                    <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">pending</span>
                  ) : (
                    <Check className="w-4 h-4 text-green-500" aria-label="confirmed" />
                  )}
                  {pending && (
                    <button
                      onClick={() => confirm(m.id)}
                      className="text-xs font-medium text-white bg-[var(--primary)] px-3 py-1 rounded-lg hover:opacity-90"
                    >
                      Confirm
                    </button>
                  )}
                  <button onClick={() => remove(m.id)} aria-label="Delete" className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/components/amelia/AmeliaMemoryPanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/amelia/AmeliaMemoryPanel.tsx src/__tests__/components/amelia/AmeliaMemoryPanel.test.tsx
git commit -m "feat(amelia): What Amelia knows panel (TDD)"
```

---

## Task 12: Two-tab wrapper + wire into the page (TDD, jsdom)

**Files:**
- Create: `src/components/amelia/AmeliaTabs.tsx`
- Modify: `src/app/(patient)/patient/amelia/page.tsx`
- Test: `src/__tests__/components/amelia/AmeliaTabs.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/amelia/AmeliaTabs.test.tsx
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/components/amelia/AmeliaChat", () => ({ __esModule: true, default: () => <div data-testid="chat" /> }));
jest.mock("@/components/amelia/AmeliaMemoryPanel", () => ({ __esModule: true, default: () => <div data-testid="panel" /> }));

import AmeliaTabs from "@/components/amelia/AmeliaTabs";

describe("AmeliaTabs", () => {
  it("shows chat by default and switches to the memory panel", () => {
    render(<AmeliaTabs />);
    expect(screen.getByTestId("chat")).toBeInTheDocument();
    expect(screen.queryByTestId("panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /what amelia knows/i }));
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/components/amelia/AmeliaTabs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/amelia/AmeliaTabs.tsx`**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import AmeliaChat from "./AmeliaChat";
import AmeliaMemoryPanel from "./AmeliaMemoryPanel";

export default function AmeliaTabs() {
  const [tab, setTab] = useState<"chat" | "memory">("chat");

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-3 self-start">
        <button
          onClick={() => setTab("chat")}
          className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition", tab === "chat" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
        >
          Chat
        </button>
        <button
          onClick={() => setTab("memory")}
          className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition", tab === "memory" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500")}
        >
          What Amelia knows
        </button>
      </div>
      <div className="flex-1 min-h-0 rounded-2xl border border-gray-100 overflow-hidden">
        {tab === "chat" ? <AmeliaChat /> : <AmeliaMemoryPanel />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/components/amelia/AmeliaTabs.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Replace `src/app/(patient)/patient/amelia/page.tsx`**

```tsx
import AmeliaTabs from "@/components/amelia/AmeliaTabs";

export const metadata = { title: "Amelia" };

export default function PatientAmeliaPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-2rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Amelia</h1>
        <p className="text-gray-500 text-sm">Your AI health assistant — ask anything, anytime.</p>
      </div>
      <div className="h-[calc(100%-4rem)]">
        <AmeliaTabs />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify build + full test run**

Run: `npx tsc --noEmit -p . && npm test`
Expected: tsc clean; all suites pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/amelia/AmeliaTabs.tsx "src/app/(patient)/patient/amelia/page.tsx" src/__tests__/components/amelia/AmeliaTabs.test.tsx
git commit -m "feat(amelia): two-tab Chat | What Amelia knows on the amelia page (TDD)"
```

---

## Task 13: End-of-phase verification, DB push, graph update, tag

**Files:** none (verification + ops)

- [ ] **Step 1: Full quality gate**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: tsc clean; all tests pass; production build succeeds.

- [ ] **Step 2: Push schema to Supabase** (REQUIRES Supabase restored from DNS-down state first)

Run: `npx prisma db push`
Expected: "Your database is now in sync" — creates `amelia_memories`.

> If Supabase is still down, STOP and restore it (dashboard → Restore) before this step. Code + tests are already green without it.

- [ ] **Step 3: Manual smoke** (valid `OPENAI_API_KEY` + DB up, logged in as the seeded patient)

Open `/patient/amelia`: tell Amelia "I'm allergic to penicillin and I have asthma." Reply should be grounded. Switch to "What Amelia knows" → the two facts appear as **pending** (high-stakes) with Confirm buttons. Confirm one → badge turns to ✓. Start a new chat turn → Amelia treats confirmed facts as known and gently raises any still-pending ones. Delete a fact → it disappears.

- [ ] **Step 4: Update the knowledge graph**

Run: `graphify update "C:\Users\IKA\Nala Vita"`
Expected: graph re-extracted with the memory module.

- [ ] **Step 5: Tag the phase**

```bash
git tag amelia-phase-2-memory-complete
```

---

## Self-Review Coverage Map (spec → task)

| Spec requirement | Task |
|---|---|
| `AmeliaMemory` model | 1 |
| Memory types | 2 |
| gpt-4o-mini extraction (model override) | 3, 4 |
| `isHighStakes` + `extractMemories` | 4 |
| `saveMemories` (dedupe + stakes→confirmed) + `getMemoriesForGrounding` | 5 |
| `listMemories` / confirm / update / delete (patient-scoped) | 6 |
| Recall injected into prompt (known + to-confirm) | 7 |
| Engine reads memory | 8 |
| Chat route writes memory after each turn | 9 |
| Memory API (GET list, PATCH confirm/edit, DELETE) | 10 |
| "What Amelia knows" panel | 11 |
| Two-tab page (Chat \| What Amelia knows) | 12 |
| RLS-protected PHI / audit | (existing RLS + Phase 1 audit; no new code) |

**Deferred (per spec §10):** doctor visibility of memory (Phase 3), conversational auto-confirm, vector/semantic retrieval, and the other four Phase 2 sub-features (reminders, med coach, lab-photo OCR, proactive card).
