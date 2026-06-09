# Amelia AI Assistant — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a grounded, safe, conversational Amelia for patients — a chat that reads the patient's real clinical record, triages symptoms, hard-stops on emergencies, and fixes the broken lab-summary button.

**Architecture:** One engine (`src/lib/amelia/`) with pure, independently-testable units: a deterministic safety layer, a prompt builder, a Prisma-backed context loader, a thin mockable LLM wrapper, and an orchestrator. A patient chat API route persists conversations; a reusable React chat component (built on the existing `ChatMessage`/`ChatInput`/`TypingIndicator`) surfaces it via a floating launcher and a dedicated page.

> **Scope note — grounding by eager-loading, not dynamic tool-calling (yet).** The spec chose a "tool-calling" brain. In Phase 1 there is effectively one read (patient context) and no write-actions, so we ground by **always loading the patient's context and injecting it into the system prompt** — deterministic, cheaper (one LLM round-trip), and equally safe (she still only sees real data). True OpenAI function-calling arrives in Phase 2 when write-tools (`setReminder`, `draftNote`) exist and the model genuinely needs to choose. This is a conscious YAGNI decision, flagged for review.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma (PostgreSQL), OpenAI `gpt-4o`, Zod, Jest (ts-jest, node + jsdom projects), Tailwind.

---

## File Structure

**Create:**
- `src/lib/amelia/types.ts` — shared types (Audience, AmeliaContext, AmeliaReply, Urgency, RedFlag)
- `src/lib/amelia/safety.ts` — deterministic red-flag detection + disclaimers (pure)
- `src/lib/amelia/prompts.ts` — system-prompt builder (pure)
- `src/lib/amelia/context.ts` — `getPatientContext()` (Prisma)
- `src/lib/amelia/audit.ts` — `stripPhi()` + `logAmeliaAudit()` (Prisma → AuditLog)
- `src/lib/amelia/llm.ts` — thin mockable OpenAI wrapper
- `src/lib/amelia/engine.ts` — `runAmeliaTurn()` orchestrator
- `src/app/api/amelia/chat/route.ts` — patient chat endpoint
- `src/app/api/ai/lab-summary/route.ts` — fixes the broken lab button
- `src/components/amelia/AmeliaChat.tsx` — chat UI (reuses existing chat components)
- `src/components/amelia/AmeliaLauncher.tsx` — floating button + slide-in panel
- `src/app/(patient)/patient/amelia/page.tsx` — dedicated full page
- Tests under `src/__tests__/lib/amelia/`, `src/__tests__/api/amelia/`, `src/__tests__/components/amelia/`

**Modify:**
- `prisma/schema.prisma` — add `AmeliaConversation` + `AmeliaMessage` models
- `src/app/(patient)/patient/layout.tsx` — mount `AmeliaLauncher`

---

## Task 0: Branch + baseline

**Files:** none (git only)

- [ ] **Step 1: Create feature branch**

```bash
cd "C:/Users/IKA/Nala Vita"
git checkout -b feat/amelia-phase-1
```

- [ ] **Step 2: Confirm baseline is green**

Run: `npx tsc --noEmit -p . && npm test`
Expected: tsc clean; jest passes (existing suites green).

---

## Task 1: Prisma models for conversations

**Files:**
- Modify: `prisma/schema.prisma` (append two models)

- [ ] **Step 1: Add the models** (append to end of `prisma/schema.prisma`)

```prisma
model AmeliaConversation {
  id        String          @id @default(cuid())
  patientId String?         @map("patient_id")
  doctorId  String?         @map("doctor_id")
  audience  String
  createdAt DateTime        @default(now()) @map("created_at")
  updatedAt DateTime        @updatedAt @map("updated_at")

  messages  AmeliaMessage[]

  @@index([patientId])
  @@index([doctorId])
  @@map("amelia_conversations")
}

model AmeliaMessage {
  id             String             @id @default(cuid())
  conversationId String             @map("conversation_id")
  role           String             // "user" | "assistant" | "tool"
  content        String
  createdAt      DateTime           @default(now()) @map("created_at")

  conversation   AmeliaConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@index([conversationId])
  @@map("amelia_messages")
}
```

- [ ] **Step 2: Validate + generate the client** (offline-safe; does NOT need the DB)

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema is valid" + "Generated Prisma Client".

> **Note:** `npx prisma db push` is deferred — the Supabase project is DNS-down. Push is a runtime prerequisite captured in Task 13, not needed for code/tests (tests mock Prisma).

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(amelia): add AmeliaConversation + AmeliaMessage models"
```

---

## Task 2: Shared types

**Files:**
- Create: `src/lib/amelia/types.ts`

- [ ] **Step 1: Write the types**

```typescript
// src/lib/amelia/types.ts
export type Audience = "patient" | "doctor";
export type Urgency = "emergency" | "routine";

export interface RedFlag {
  pattern: string;
  reason: string;
}

export interface AmeliaContext {
  firstName: string;
  age: number | null;
  gender: string | null;
  allergies: string[];
  activeMedications: { medication: string; dosage: string; frequency: string }[];
  recentVitals: {
    recordedAt: string;
    bloodPressure: string | null;
    heartRate: number | null;
    bloodSugar: number | null;
    oxygenSaturation: number | null;
  }[];
  recentLabs: { testName: string; resultValue: string; unit: string | null; isAbnormal: boolean }[];
}

export interface AmeliaTurnInput {
  audience: Audience;
  patientId: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface AmeliaReply {
  content: string;
  urgency: Urgency;
  redFlags: RedFlag[];
  disclaimer: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/amelia/types.ts
git commit -m "feat(amelia): shared types"
```

---

## Task 3: Safety layer (TDD)

**Files:**
- Create: `src/lib/amelia/safety.ts`
- Test: `src/__tests__/lib/amelia/safety.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/safety.test.ts
import { describe, it, expect } from "@jest/globals";
import { detectRedFlags, urgencyFromRedFlags, PATIENT_DISCLAIMER, EMERGENCY_MESSAGE } from "@/lib/amelia/safety";

describe("amelia safety", () => {
  it("flags an emergency phrase", () => {
    const flags = detectRedFlags("I have crushing chest pain and can't breathe");
    expect(flags.length).toBeGreaterThan(0);
    expect(urgencyFromRedFlags(flags)).toBe("emergency");
  });

  it("does not flag a mild symptom", () => {
    const flags = detectRedFlags("I have a mild headache and a runny nose");
    expect(flags).toHaveLength(0);
    expect(urgencyFromRedFlags(flags)).toBe("routine");
  });

  it("exposes the disclaimer and emergency strings", () => {
    expect(PATIENT_DISCLAIMER).toMatch(/not a substitute/i);
    expect(EMERGENCY_MESSAGE).toMatch(/emergency/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/safety.test.ts`
Expected: FAIL — "Cannot find module '@/lib/amelia/safety'".

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/amelia/safety.ts
import type { RedFlag, Urgency } from "./types";

const RED_FLAG_RULES: { test: RegExp; reason: string }[] = [
  { test: /\b(chest pain|pressure in (my )?chest|crushing chest)\b/i, reason: "Possible cardiac emergency" },
  { test: /\b(can'?t breathe|trouble breathing|short(ness)? of breath|gasping)\b/i, reason: "Possible respiratory distress" },
  { test: /\b(face droop|slurred speech|sudden numbness|can'?t move (my )?(arm|leg))\b/i, reason: "Possible stroke (FAST signs)" },
  { test: /\b(suicidal|kill myself|end my life|want to die)\b/i, reason: "Mental-health crisis" },
  { test: /\b(severe bleeding|won'?t stop bleeding|coughing up blood|vomiting blood)\b/i, reason: "Severe hemorrhage" },
  { test: /\b(unconscious|passed out|unresponsive|seizure)\b/i, reason: "Loss of consciousness / seizure" },
  { test: /\b(throat closing|anaphylaxis|swelling of (my )?(face|tongue|throat))\b/i, reason: "Possible anaphylaxis" },
];

export function detectRedFlags(text: string): RedFlag[] {
  return RED_FLAG_RULES.filter((r) => r.test.test(text)).map((r) => ({
    pattern: r.test.source,
    reason: r.reason,
  }));
}

export function urgencyFromRedFlags(flags: RedFlag[]): Urgency {
  return flags.length > 0 ? "emergency" : "routine";
}

export const PATIENT_DISCLAIMER =
  "Amelia is an AI health assistant, not a substitute for a doctor. For anything serious or worsening, please consult a healthcare professional.";

export const EMERGENCY_MESSAGE =
  "⚠️ Your symptoms may indicate a medical emergency. Please call your local emergency number or go to the nearest emergency department now.";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/safety.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/safety.ts src/__tests__/lib/amelia/safety.test.ts
git commit -m "feat(amelia): deterministic safety layer (TDD)"
```

---

## Task 4: Prompt builder (TDD)

**Files:**
- Create: `src/lib/amelia/prompts.ts`
- Test: `src/__tests__/lib/amelia/prompts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/prompts.test.ts
import { describe, it, expect } from "@jest/globals";
import { renderContext, patientAdvisorPrompt } from "@/lib/amelia/prompts";
import type { AmeliaContext } from "@/lib/amelia/types";

const ctx: AmeliaContext = {
  firstName: "Ada",
  age: 34,
  gender: "female",
  allergies: ["penicillin"],
  activeMedications: [{ medication: "lisinopril", dosage: "10mg", frequency: "daily" }],
  recentVitals: [{ recordedAt: "2026-06-01", bloodPressure: "150/95", heartRate: 88, bloodSugar: null, oxygenSaturation: 98 }],
  recentLabs: [{ testName: "HbA1c", resultValue: "6.1", unit: "%", isAbnormal: false }],
};

describe("amelia prompts", () => {
  it("renders the patient's real data", () => {
    const out = renderContext(ctx);
    expect(out).toMatch(/penicillin/);
    expect(out).toMatch(/lisinopril/);
    expect(out).toMatch(/150\/95/);
  });

  it("builds an Advisor system prompt naming Amelia + the patient", () => {
    const p = patientAdvisorPrompt(ctx);
    expect(p).toMatch(/Amelia/);
    expect(p).toMatch(/Ada/);
    expect(p).toMatch(/confirm with a doctor/i);
    expect(p).toMatch(/emergency/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/prompts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/amelia/prompts.ts
import type { AmeliaContext } from "./types";

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

export function patientAdvisorPrompt(ctx: AmeliaContext): string {
  return `You are Amelia, a warm, careful AI health assistant on the Nala Vita platform.

You are speaking directly to a patient who may not have a doctor. Your role is "Advisor":
- Explain symptoms in plain, reassuring language.
- You MAY name likely possible conditions ("this could be X, Y, or Z"), recommend over-the-counter remedies and self-care, and interpret lab/vital values.
- You MUST NOT prescribe prescription-only medication or give a definitive diagnosis.
- ALWAYS close by recommending the patient confirm with a doctor, and offer to help them book one.
- If the patient describes a possible emergency, your FIRST priority is to tell them to seek emergency care immediately.
- Use the patient's real data below to ground every answer. Never invent medications, allergies, or results that are not listed.

PATIENT CONTEXT (real data from their record):
${renderContext(ctx)}

Keep replies concise, kind, and structured. Be honest about urgency without being alarmist.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/prompts.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/prompts.ts src/__tests__/lib/amelia/prompts.test.ts
git commit -m "feat(amelia): grounded prompt builder (TDD)"
```

---

## Task 5: Patient context loader (TDD, mocked Prisma)

**Files:**
- Create: `src/lib/amelia/context.ts`
- Test: `src/__tests__/lib/amelia/context.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/context.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { patient: { findUnique: (...a: unknown[]) => findUnique(...a) } } }));

import { getPatientContext } from "@/lib/amelia/context";

beforeEach(() => findUnique.mockReset());

describe("getPatientContext", () => {
  it("maps the patient record into a grounded context", async () => {
    findUnique.mockResolvedValue({
      user: { firstName: "Ada" },
      dateOfBirth: new Date("1992-01-01"),
      gender: "female",
      allergies: ["penicillin"],
      prescriptions: [{ medication: "lisinopril", dosage: "10mg", frequency: "daily" }],
      vitals: [{ recordedAt: new Date("2026-06-01"), bloodPressure: "150/95", heartRate: 88, bloodSugar: null, oxygenSaturation: 98 }],
      labOrders: [{ testName: "HbA1c", results: [{ resultValue: "6.1", unit: "%", isAbnormal: false }] }],
    });

    const ctx = await getPatientContext("pat_1");
    expect(ctx.firstName).toBe("Ada");
    expect(ctx.allergies).toContain("penicillin");
    expect(ctx.activeMedications[0].medication).toBe("lisinopril");
    expect(ctx.recentLabs[0].testName).toBe("HbA1c");
    expect(ctx.age).toBeGreaterThan(30);
  });

  it("throws when the patient is missing", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getPatientContext("nope")).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/context.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/amelia/context.ts
import { prisma } from "@/lib/prisma";
import type { AmeliaContext } from "./types";

function ageFromDob(dob: Date | null): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export async function getPatientContext(patientId: string): Promise<AmeliaContext> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      user: true,
      vitals: { orderBy: { recordedAt: "desc" }, take: 3 },
      prescriptions: { where: { isActive: true }, orderBy: { prescribedAt: "desc" }, take: 10 },
      labOrders: { orderBy: { orderedAt: "desc" }, take: 5, include: { results: true } },
    },
  });

  if (!patient) throw new Error(`Patient not found: ${patientId}`);

  const recentLabs = patient.labOrders.flatMap((o) =>
    o.results.map((r) => ({ testName: o.testName, resultValue: r.resultValue, unit: r.unit, isAbnormal: r.isAbnormal }))
  );

  return {
    firstName: patient.user.firstName,
    age: ageFromDob(patient.dateOfBirth),
    gender: patient.gender,
    allergies: patient.allergies,
    activeMedications: patient.prescriptions.map((p) => ({ medication: p.medication, dosage: p.dosage, frequency: p.frequency })),
    recentVitals: patient.vitals.map((v) => ({
      recordedAt: v.recordedAt.toISOString().slice(0, 10),
      bloodPressure: v.bloodPressure,
      heartRate: v.heartRate,
      bloodSugar: v.bloodSugar,
      oxygenSaturation: v.oxygenSaturation,
    })),
    recentLabs,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/context.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/context.ts src/__tests__/lib/amelia/context.test.ts
git commit -m "feat(amelia): Prisma-backed patient context loader (TDD)"
```

---

## Task 6: Audit helper (TDD, mocked Prisma)

**Files:**
- Create: `src/lib/amelia/audit.ts`
- Test: `src/__tests__/lib/amelia/audit.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/audit.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const create = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: (...a: unknown[]) => create(...a) } } }));

import { stripPhi, logAmeliaAudit } from "@/lib/amelia/audit";

beforeEach(() => create.mockReset());

describe("amelia audit", () => {
  it("strips emails and phone numbers", () => {
    expect(stripPhi("reach me at ada@x.com or 080-1234-5678")).not.toMatch(/ada@x\.com/);
    expect(stripPhi("call 08012345678")).toMatch(/\[phone\]/);
  });

  it("writes a PHI-stripped AuditLog row", async () => {
    create.mockResolvedValue({});
    await logAmeliaAudit({ userId: "u1", action: "amelia.chat", conversationId: "c1", summary: "email ada@x.com urgency=routine" });
    expect(create).toHaveBeenCalledTimes(1);
    const arg = create.mock.calls[0][0] as { data: { metadata: string; resourceType: string } };
    expect(arg.data.metadata).not.toMatch(/ada@x\.com/);
    expect(arg.data.resourceType).toBe("AmeliaConversation");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/audit.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/amelia/audit.ts
import { prisma } from "@/lib/prisma";

const PHI_PATTERNS: { test: RegExp; replace: string }[] = [
  { test: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, replace: "[email]" },
  { test: /\b\+?\d[\d\s-]{7,}\d\b/g, replace: "[phone]" },
];

export function stripPhi(text: string): string {
  return PHI_PATTERNS.reduce((acc, p) => acc.replace(p.test, p.replace), text);
}

export async function logAmeliaAudit(params: {
  userId: string;
  action: string;
  conversationId: string;
  summary: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resourceType: "AmeliaConversation",
      resourceId: params.conversationId,
      metadata: stripPhi(params.summary).slice(0, 500),
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/lib/amelia/audit.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/audit.ts src/__tests__/lib/amelia/audit.test.ts
git commit -m "feat(amelia): PHI-stripping audit helper (TDD)"
```

---

## Task 7: LLM wrapper (thin, mockable)

**Files:**
- Create: `src/lib/amelia/llm.ts`

- [ ] **Step 1: Write the implementation** (no test — this is the one impure boundary; it is mocked by every consumer's test)

```typescript
// src/lib/amelia/llm.ts
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chat(messages: ChatTurn[], opts?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    temperature: opts?.temperature ?? 0.4,
    max_tokens: opts?.maxTokens ?? 800,
  });
  return completion.choices[0]?.message?.content?.trim() ?? "";
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/amelia/llm.ts
git commit -m "feat(amelia): thin mockable OpenAI wrapper"
```

---

## Task 8: Engine orchestrator (TDD, mocked context + llm)

**Files:**
- Create: `src/lib/amelia/engine.ts`
- Test: `src/__tests__/lib/amelia/engine.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/engine.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getPatientContext = jest.fn();
const chat = jest.fn();
jest.mock("@/lib/amelia/context", () => ({ getPatientContext: (...a: unknown[]) => getPatientContext(...a) }));
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));

import { runAmeliaTurn } from "@/lib/amelia/engine";

beforeEach(() => {
  getPatientContext.mockReset();
  chat.mockReset();
});

describe("runAmeliaTurn", () => {
  it("short-circuits on an emergency without calling the LLM", async () => {
    const reply = await runAmeliaTurn({
      audience: "patient",
      patientId: "p1",
      messages: [{ role: "user", content: "I have crushing chest pain" }],
    });
    expect(reply.urgency).toBe("emergency");
    expect(reply.content).toMatch(/emergency/i);
    expect(chat).not.toHaveBeenCalled();
    expect(getPatientContext).not.toHaveBeenCalled();
  });

  it("grounds a normal turn in patient context and returns the LLM reply", async () => {
    getPatientContext.mockResolvedValue({
      firstName: "Ada", age: 34, gender: "female", allergies: [], activeMedications: [], recentVitals: [], recentLabs: [],
    });
    chat.mockResolvedValue("Here is some careful advice. Please confirm with a doctor.");

    const reply = await runAmeliaTurn({
      audience: "patient",
      patientId: "p1",
      messages: [{ role: "user", content: "I have a mild sore throat" }],
    });

    expect(getPatientContext).toHaveBeenCalledWith("p1");
    expect(chat).toHaveBeenCalledTimes(1);
    expect(reply.urgency).toBe("routine");
    expect(reply.content).toMatch(/careful advice/);
    expect(reply.disclaimer).toMatch(/not a substitute/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/lib/amelia/engine.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/amelia/engine.ts
import { getPatientContext } from "./context";
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

  const ctx = await getPatientContext(input.patientId);
  const turns: ChatTurn[] = [
    { role: "system", content: patientAdvisorPrompt(ctx) },
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
git commit -m "feat(amelia): engine orchestrator with emergency short-circuit (TDD)"
```

---

## Task 9: Patient chat API route (TDD — auth gate + happy path)

**Files:**
- Create: `src/app/api/amelia/chat/route.ts`
- Test: `src/__tests__/api/amelia/chat.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/api/amelia/chat.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));

const userFindUnique = jest.fn();
const convoFindFirst = jest.fn();
const convoCreate = jest.fn();
const msgCreate = jest.fn();
const msgFindMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    ameliaConversation: { findFirst: (...a: unknown[]) => convoFindFirst(...a), create: (...a: unknown[]) => convoCreate(...a) },
    ameliaMessage: { create: (...a: unknown[]) => msgCreate(...a), findMany: (...a: unknown[]) => msgFindMany(...a) },
  },
}));

jest.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: async () => ({ allowed: true, remaining: 19, resetAt: Date.now() + 60000 }) }));
const runAmeliaTurn = jest.fn();
jest.mock("@/lib/amelia/engine", () => ({ runAmeliaTurn: (...a: unknown[]) => runAmeliaTurn(...a) }));
jest.mock("@/lib/amelia/audit", () => ({ logAmeliaAudit: async () => undefined }));

import { POST } from "@/app/api/amelia/chat/route";

function req(body: unknown) {
  return new Request("http://localhost/api/amelia/chat", { method: "POST", body: JSON.stringify(body) }) as never;
}

beforeEach(() => {
  [getUser, userFindUnique, convoFindFirst, convoCreate, msgCreate, msgFindMany, runAmeliaTurn].forEach((m) => m.mockReset());
});

describe("POST /api/amelia/chat", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ message: "hi" }));
    expect(res.status).toBe(401);
  });

  it("returns Amelia's reply on the happy path", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub-1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    convoCreate.mockResolvedValue({ id: "c1" });
    msgCreate.mockResolvedValue({});
    msgFindMany.mockResolvedValue([{ role: "user", content: "I have a sore throat" }]);
    runAmeliaTurn.mockResolvedValue({ content: "Advice. Confirm with a doctor.", urgency: "routine", redFlags: [], disclaimer: "d" });

    const res = await POST(req({ message: "I have a sore throat" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.conversationId).toBe("c1");
    expect(json.reply.content).toMatch(/Advice/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/amelia/chat.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/api/amelia/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { runAmeliaTurn } from "@/lib/amelia/engine";
import { logAmeliaAudit } from "@/lib/amelia/audit";

const bodySchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
    if (!user?.patient) return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });

    const limit = await checkRateLimitAsync(`amelia:chat:${user.id}`, { maxRequests: 20, windowMs: 60_000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
      );
    }

    const { conversationId, message } = bodySchema.parse(await req.json());

    let convo = conversationId
      ? await prisma.ameliaConversation.findFirst({ where: { id: conversationId, patientId: user.patient.id } })
      : null;
    if (!convo) {
      convo = await prisma.ameliaConversation.create({ data: { patientId: user.patient.id, audience: "patient" } });
    }

    await prisma.ameliaMessage.create({ data: { conversationId: convo.id, role: "user", content: message } });

    const history = await prisma.ameliaMessage.findMany({
      where: { conversationId: convo.id },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    const reply = await runAmeliaTurn({
      audience: "patient",
      patientId: user.patient.id,
      messages: history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    await prisma.ameliaMessage.create({ data: { conversationId: convo.id, role: "assistant", content: reply.content } });

    await logAmeliaAudit({
      userId: user.id,
      action: "amelia.chat",
      conversationId: convo.id,
      summary: `urgency=${reply.urgency} redFlags=${reply.redFlags.length}`,
    });

    return NextResponse.json({ conversationId: convo.id, reply });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Amelia chat error:", error);
    return NextResponse.json({ error: "Amelia is unavailable right now." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/api/amelia/chat.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/amelia/chat/route.ts src/__tests__/api/amelia/chat.test.ts
git commit -m "feat(amelia): patient chat API route (TDD)"
```

---

## Task 10: Lab-summary route — fixes the broken button (TDD)

**Files:**
- Create: `src/app/api/ai/lab-summary/route.ts`
- Test: `src/__tests__/api/amelia/lab-summary.test.ts`

> Contract is fixed by the existing caller `src/app/(patient)/patient/lab-results/page.tsx:175`:
> POST `{ testName, results[] }` → `{ summary: string }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/api/amelia/lab-summary.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } } }));
jest.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: async () => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }) }));
const chat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));

import { POST } from "@/app/api/ai/lab-summary/route";

function req(body: unknown) {
  return new Request("http://localhost/api/ai/lab-summary", { method: "POST", body: JSON.stringify(body) }) as never;
}

beforeEach(() => [getUser, userFindUnique, chat].forEach((m) => m.mockReset()));

describe("POST /api/ai/lab-summary", () => {
  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ testName: "CBC", results: [{ resultValue: "5" }] }));
    expect(res.status).toBe(401);
  });

  it("returns a plain-language summary", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1" });
    chat.mockResolvedValue("Your results look mostly normal. Please confirm with a doctor.");
    const res = await POST(req({ testName: "HbA1c", results: [{ resultValue: "6.1", unit: "%", isAbnormal: false }] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.summary).toMatch(/normal/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/api/amelia/lab-summary.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```typescript
// src/app/api/ai/lab-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { checkRateLimitAsync } from "@/lib/rate-limit";
import { chat } from "@/lib/amelia/llm";

const resultSchema = z.object({
  resultValue: z.string(),
  unit: z.string().nullable().optional(),
  referenceMin: z.string().nullable().optional(),
  referenceMax: z.string().nullable().optional(),
  isAbnormal: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});
const bodySchema = z.object({ testName: z.string().min(1), results: z.array(resultSchema).min(1) });

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const limit = await checkRateLimitAsync(`amelia:lab-summary:${user.id}`);
    if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

    const { testName, results } = bodySchema.parse(await req.json());
    const rows = results
      .map((r) => `- ${r.resultValue}${r.unit ? " " + r.unit : ""}${r.referenceMin || r.referenceMax ? ` (ref ${r.referenceMin ?? "?"}-${r.referenceMax ?? "?"})` : ""}${r.isAbnormal ? " [flagged abnormal]" : ""}`)
      .join("\n");

    const summary = await chat(
      [
        { role: "system", content: "You are Amelia, a health assistant. Explain lab results to a patient in plain, calm language. Do not diagnose. Always end by suggesting they confirm with a doctor." },
        { role: "user", content: `Explain my "${testName}" results:\n${rows}` },
      ],
      { temperature: 0.3, maxTokens: 400 }
    );

    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Lab summary error:", error);
    return NextResponse.json({ error: "Failed to summarize results." }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/api/amelia/lab-summary.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/lab-summary/route.ts src/__tests__/api/amelia/lab-summary.test.ts
git commit -m "fix(amelia): implement /api/ai/lab-summary (was a broken 404 call)"
```

---

## Task 11: Amelia chat component (TDD, jsdom)

**Files:**
- Create: `src/components/amelia/AmeliaChat.tsx`
- Test: `src/__tests__/components/amelia/AmeliaChat.test.tsx`

> Reuses default-exported `ChatMessage`, `ChatInput`, `TypingIndicator` from `src/components/chat/`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/amelia/AmeliaChat.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the child chat components so this test exercises AmeliaChat's own
// logic (state, fetch, reply rendering) without coupling to ChatInput's
// internal Enter/button behavior.
jest.mock("@/components/chat/ChatMessage", () => ({
  __esModule: true,
  default: ({ content }: { content: string }) => <div data-testid="msg">{content}</div>,
}));
jest.mock("@/components/chat/TypingIndicator", () => ({
  __esModule: true,
  default: () => <div data-testid="typing" />,
}));
jest.mock("@/components/chat/ChatInput", () => ({
  __esModule: true,
  default: ({ value, onChange, onSend }: { value: string; onChange: (v: string) => void; onSend: () => void }) => (
    <div>
      <textarea aria-label="message" value={value} onChange={(e) => onChange(e.target.value)} />
      <button onClick={() => onSend()}>send</button>
    </div>
  ),
}));

import AmeliaChat from "@/components/amelia/AmeliaChat";

beforeEach(() => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ conversationId: "c1", reply: { content: "Stay hydrated. Confirm with a doctor.", urgency: "routine", redFlags: [], disclaimer: "d" } }),
  })) as unknown as jest.Mock;
});

describe("AmeliaChat", () => {
  it("renders the greeting and disclaimer", () => {
    render(<AmeliaChat />);
    expect(screen.getByText(/Tell me how you/i)).toBeInTheDocument();
    expect(screen.getByText(/not a substitute/i)).toBeInTheDocument();
  });

  it("sends a message and renders Amelia's reply", async () => {
    render(<AmeliaChat />);
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "I feel dehydrated" } });
    fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByText(/Stay hydrated/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/components/amelia/AmeliaChat.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/amelia/AmeliaChat.tsx
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { PATIENT_DISCLAIMER } from "@/lib/amelia/safety";

interface UiMessage { role: "user" | "assistant"; content: string; sentAt: string }

export default function AmeliaChat() {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [emergency, setEmergency] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text, sentAt: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await fetch("/api/amelia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setConversationId(data.conversationId);
        setEmergency(data.reply.urgency === "emergency");
        setMessages((m) => [...m, { role: "assistant", content: data.reply.content, sentAt: new Date().toISOString() }]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.error ?? "Amelia is unavailable.", sentAt: new Date().toISOString() }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Amelia is unavailable right now.", sentAt: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {emergency && (
        <div className="bg-red-600 text-white text-sm font-semibold px-4 py-2">
          ⚠️ Possible emergency — please seek care now.
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            <Sparkles className="w-6 h-6 mx-auto mb-2 text-[var(--primary)]" />
            Hi, I&apos;m Amelia. Tell me how you&apos;re feeling or ask a health question.
          </div>
        )}
        {messages.map((m, i) => (
          <ChatMessage key={i} isMine={m.role === "user"} content={m.content} sentAt={m.sentAt} otherInitials="A" />
        ))}
        {sending && <TypingIndicator />}
      </div>
      <p className="text-[10px] leading-snug text-gray-400 px-4 py-1 border-t border-gray-100">{PATIENT_DISCLAIMER}</p>
      <div className="p-2 border-t border-gray-100">
        <ChatInput value={input} onChange={setInput} onSend={send} isSending={sending} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/components/amelia/AmeliaChat.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/amelia/AmeliaChat.tsx src/__tests__/components/amelia/AmeliaChat.test.tsx
git commit -m "feat(amelia): patient chat component reusing existing chat UI (TDD)"
```

---

## Task 12: Floating launcher + dedicated page + nav

**Files:**
- Create: `src/components/amelia/AmeliaLauncher.tsx`
- Create: `src/app/(patient)/patient/amelia/page.tsx`
- Modify: `src/app/(patient)/patient/layout.tsx` (mount launcher)
- Test: `src/__tests__/components/amelia/AmeliaLauncher.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/amelia/AmeliaLauncher.test.tsx
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/components/amelia/AmeliaChat", () => ({ __esModule: true, default: () => <div data-testid="amelia-chat" /> }));

import AmeliaLauncher from "@/components/amelia/AmeliaLauncher";

describe("AmeliaLauncher", () => {
  it("is closed by default and opens on click", () => {
    render(<AmeliaLauncher />);
    expect(screen.queryByTestId("amelia-chat")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /amelia/i }));
    expect(screen.getByTestId("amelia-chat")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/components/amelia/AmeliaLauncher.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the launcher**

```tsx
// src/components/amelia/AmeliaLauncher.tsx
"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import AmeliaChat from "./AmeliaChat";

export default function AmeliaLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[90vw] max-w-sm h-[70vh] rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between bg-[var(--primary)] text-white px-4 py-3">
            <span className="flex items-center gap-2 font-semibold text-sm"><Sparkles className="w-4 h-4" /> Amelia</span>
            <button aria-label="Close Amelia" onClick={() => setOpen(false)}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 min-h-0"><AmeliaChat /></div>
        </div>
      )}
      <button
        aria-label="Ask Amelia"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    </>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/components/amelia/AmeliaLauncher.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Create the dedicated page**

```tsx
// src/app/(patient)/patient/amelia/page.tsx
import AmeliaChat from "@/components/amelia/AmeliaChat";

export const metadata = { title: "Amelia" };

export default function PatientAmeliaPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-2rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Amelia</h1>
        <p className="text-gray-500 text-sm">Your AI health assistant — ask anything, anytime.</p>
      </div>
      <div className="h-[calc(100%-4rem)] rounded-2xl border border-gray-100 overflow-hidden">
        <AmeliaChat />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Mount the launcher in the patient layout**

In `src/app/(patient)/patient/layout.tsx`, add the import at the top:

```typescript
import AmeliaLauncher from "@/components/amelia/AmeliaLauncher";
```

Then change the returned JSX from:

```tsx
  return (
    <div className="flex min-h-screen bg-gray-50">
      <PatientSidebar user={user} />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
```

to:

```tsx
  return (
    <div className="flex min-h-screen bg-gray-50">
      <PatientSidebar user={user} />
      <div className="flex-1 min-w-0">{children}</div>
      <AmeliaLauncher />
    </div>
  );
```

- [ ] **Step 7: Verify build + full test run**

Run: `npx tsc --noEmit -p . && npm test`
Expected: tsc clean; all Amelia tests pass alongside existing suites.

- [ ] **Step 8: Commit**

```bash
git add src/components/amelia/AmeliaLauncher.tsx src/app/\(patient\)/patient/amelia/page.tsx "src/app/(patient)/patient/layout.tsx" src/__tests__/components/amelia/AmeliaLauncher.test.tsx
git commit -m "feat(amelia): floating launcher + dedicated page, mounted in patient layout"
```

---

## Task 13: End-of-phase verification, DB push, graph update, tag

**Files:** none (verification + ops)

- [ ] **Step 1: Full quality gate**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: tsc clean; all tests pass; production build succeeds.

- [ ] **Step 2: Push the schema to Supabase** (runtime prerequisite — REQUIRES the Supabase project to be restored from its DNS-down state first)

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema." Creates `amelia_conversations` + `amelia_messages` tables.

> If Supabase is still down, STOP and restore the project (dashboard → Restore) before this step. Code + tests are already green without it.

- [ ] **Step 3: Manual smoke (with a valid `OPENAI_API_KEY` and the DB up)**

```bash
npm start
```
Then, logged in as the seeded patient: open `/patient/amelia`, send "I have a mild sore throat" → expect a grounded Advisor reply ending with a "confirm with a doctor" nudge. Send "I have crushing chest pain" → expect the immediate red emergency banner + escalation message (no LLM delay). On `/patient/lab-results`, click "Explain my results" → expect a plain-language summary (no longer a 404).

- [ ] **Step 4: Update the knowledge graph**

Run: `graphify update "C:\Users\IKA\Nala Vita"`
Expected: graph re-extracted, Amelia nodes added.

- [ ] **Step 5: Tag the phase**

```bash
git tag amelia-phase-1-complete
```

- [ ] **Step 6: Update FOLLOW_UPS**

In `docs/FOLLOW_UPS.md`, remove the broken-lab-summary concern if listed, and note Phases 2-3 (memory, reminders, med coach, lab-photo OCR, doctor copilot) as the next Amelia work. Commit:

```bash
git add docs/FOLLOW_UPS.md
git commit -m "docs: Amelia Phase 1 complete; note Phase 2-3 follow-ups"
```

---

## Self-Review Coverage Map (spec → task)

| Spec requirement | Task |
|---|---|
| `src/lib/amelia/` engine + prompts + safety + context | 2–8 |
| Advisor tier prompt + "confirm with a doctor" | 4 |
| Emergency hard-stop (pre-LLM, deterministic) | 3, 8 |
| Grounding on real EHR data | 5, 8 |
| Audit logging + PHI strip | 6 |
| Rate limit + cost ceiling (max_tokens, 20/min) | 7, 9, 10 |
| `AmeliaConversation` + `AmeliaMessage` models | 1 |
| Patient chat: floating launcher + `/patient/amelia` | 11, 12 |
| Reuse existing chat components | 11 |
| Fix broken lab-summary button | 10 |
| Safety UX (emergency banner + disclaimer footer) | 11 |

**Deferred to later phases (per spec §8/§11):** memory, reminders, medication coach, lab-photo OCR, proactive dashboard card (Phase 2); full doctor copilot (Phase 3); dynamic tool-calling, streaming, background push (noted).
