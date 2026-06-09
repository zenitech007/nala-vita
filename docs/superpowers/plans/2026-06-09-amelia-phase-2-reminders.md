# Amelia Phase 2 — Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a patient ask Amelia in plain language for a reminder; Amelia proposes a structured reminder the patient confirms with one inline tap; due reminders fire lazily into the notification bell — no background infra.

**Architecture:** A new `src/lib/amelia/reminders.ts` (detect via gpt-4o-mini → deterministic schedule → patient-scoped CRUD → `fireDueReminders`). The chat route returns a `reminderSuggestion`; an in-chat `ReminderCard` POSTs it on confirm. `fireDueReminders(patientId, userId)` is called from the existing `GET /api/notifications` route, so reminders surface on the bell's next poll. A third "Reminders" tab manages (view/cancel) existing reminders.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma (PostgreSQL), OpenAI (gpt-4o-mini), Zod, Jest (node + jsdom).

**Spec:** `docs/superpowers/specs/2026-06-09-amelia-phase-2-reminders-design.md`

---

## File Structure

**Create:**
- `src/lib/amelia/reminders.ts` — detect, schedule, describe, fire, CRUD
- `src/app/api/amelia/reminders/route.ts` — `POST` create + `GET` list
- `src/app/api/amelia/reminders/[id]/route.ts` — `DELETE` cancel
- `src/components/amelia/ReminderCard.tsx` — inline confirmation card
- `src/components/amelia/AmeliaRemindersPanel.tsx` — the Reminders tab
- Tests under `src/__tests__/lib/amelia/`, `…/api/amelia/`, `…/components/amelia/`

**Modify:**
- `prisma/schema.prisma` — add `Reminder` model
- `src/lib/amelia/types.ts` — reminder types
- `src/app/api/amelia/chat/route.ts` — return `reminderSuggestion`
- `src/app/api/notifications/route.ts` — call `fireDueReminders` for patients
- `src/components/amelia/AmeliaChat.tsx` — render `ReminderCard`
- `src/components/amelia/AmeliaTabs.tsx` — add the Reminders tab
- `src/__tests__/api/amelia/chat.test.ts` — mock `reminders` (route now imports it)

---

## Task 0: Branch + baseline

- [ ] **Step 1: Branch**

```bash
cd "C:/Users/IKA/Nala Vita"
git checkout -b feat/amelia-phase-2-reminders
```

- [ ] **Step 2: Baseline green**

Run: `npx tsc --noEmit -p . && npm test`
Expected: tsc clean; all suites pass.

---

## Task 1: Reminder model

**Files:** Modify `prisma/schema.prisma` (append)

- [ ] **Step 1: Append to the end of `prisma/schema.prisma`**

```prisma
model Reminder {
  id         String   @id @default(cuid())
  patientId  String   @map("patient_id")
  kind       String   // MEDICATION | APPOINTMENT | VITALS | OTHER
  label      String
  frequency  String   // ONCE | DAILY
  nextFireAt DateTime @map("next_fire_at")
  active     Boolean  @default(true)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@index([patientId])
  @@index([active, nextFireAt])
  @@map("reminders")
}
```

- [ ] **Step 2: Validate + generate** (offline; NOT `db push` — Supabase down)

Run: `npx prisma validate && npx prisma generate`
Expected: "The schema is valid" + "Generated Prisma Client".

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(amelia): add Reminder model"
```

---

## Task 2: Reminder types

**Files:** Modify `src/lib/amelia/types.ts` (append)

- [ ] **Step 1: Append to `src/lib/amelia/types.ts`**

```typescript
export type ReminderKind = "MEDICATION" | "APPOINTMENT" | "VITALS" | "OTHER";
export type ReminderFrequency = "ONCE" | "DAILY";

export interface ReminderCandidate {
  kind: ReminderKind;
  label: string;
  frequency: ReminderFrequency;
  hour?: number;        // DAILY
  minute?: number;      // DAILY
  isoDateTime?: string; // ONCE
}

export interface ReminderSuggestion {
  kind: ReminderKind;
  label: string;
  frequency: ReminderFrequency;
  nextFireAt: string; // ISO
  schedule: string;   // human-readable
}

export interface ReminderRecord {
  id: string;
  kind: ReminderKind;
  label: string;
  frequency: ReminderFrequency;
  nextFireAt: string; // ISO
  schedule: string;
}
```

- [ ] **Step 2: Verify** — Run: `npx tsc --noEmit -p .` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/amelia/types.ts
git commit -m "feat(amelia): reminder types"
```

---

## Task 3: detect + schedule + describe (TDD)

**Files:**
- Create: `src/lib/amelia/reminders.ts` (first part)
- Test: `src/__tests__/lib/amelia/reminders-detect.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/reminders-detect.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const chat = jest.fn();
jest.mock("@/lib/amelia/llm", () => ({ chat: (...a: unknown[]) => chat(...a) }));
jest.mock("@/lib/prisma", () => ({ prisma: {} }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { detectReminder, computeNextFireAt, describeSchedule } from "@/lib/amelia/reminders";
import type { ReminderCandidate } from "@/lib/amelia/types";

beforeEach(() => chat.mockReset());

describe("detectReminder", () => {
  it("returns null when the patient isn't asking for a reminder", async () => {
    chat.mockResolvedValue("null");
    expect(await detectReminder("what is a fever?", "A fever is...")).toBeNull();
  });

  it("parses a DAILY reminder", async () => {
    chat.mockResolvedValue('{"kind":"MEDICATION","label":"take BP meds","frequency":"DAILY","hour":8,"minute":0}');
    const c = await detectReminder("remind me to take my BP meds at 8am", "Sure!");
    expect(c).toEqual({ kind: "MEDICATION", label: "take BP meds", frequency: "DAILY", hour: 8, minute: 0 });
  });

  it("rejects an invalid kind", async () => {
    chat.mockResolvedValue('{"kind":"NOPE","label":"x","frequency":"DAILY","hour":8,"minute":0}');
    expect(await detectReminder("x", "y")).toBeNull();
  });
});

describe("computeNextFireAt", () => {
  it("DAILY picks today if the time is still ahead", () => {
    const now = new Date(2026, 5, 12, 6, 0, 0); // Jun 12, 06:00 local
    const c: ReminderCandidate = { kind: "MEDICATION", label: "m", frequency: "DAILY", hour: 8, minute: 0 };
    const next = computeNextFireAt(c, now);
    expect(next.getDate()).toBe(12);
    expect(next.getHours()).toBe(8);
  });

  it("DAILY rolls to tomorrow if the time already passed", () => {
    const now = new Date(2026, 5, 12, 9, 0, 0);
    const c: ReminderCandidate = { kind: "MEDICATION", label: "m", frequency: "DAILY", hour: 8, minute: 0 };
    expect(computeNextFireAt(c, now).getDate()).toBe(13);
  });

  it("ONCE uses the given datetime", () => {
    const now = new Date(2026, 5, 12, 9, 0, 0);
    const iso = new Date(2026, 5, 14, 14, 0, 0).toISOString();
    const c: ReminderCandidate = { kind: "APPOINTMENT", label: "appt", frequency: "ONCE", isoDateTime: iso };
    expect(computeNextFireAt(c, now).toISOString()).toBe(iso);
  });
});

describe("describeSchedule", () => {
  it("formats DAILY", () => {
    expect(describeSchedule("DAILY", new Date(2026, 5, 12, 8, 0))).toBe("every day at 8:00 AM");
  });
  it("formats ONCE", () => {
    expect(describeSchedule("ONCE", new Date(2026, 5, 12, 14, 30))).toMatch(/on Jun 12 at 2:30 PM/);
  });
});
```

- [ ] **Step 2: Run** → `npx jest src/__tests__/lib/amelia/reminders-detect.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create `src/lib/amelia/reminders.ts`**

```typescript
// src/lib/amelia/reminders.ts
import { prisma } from "@/lib/prisma";
import { chat } from "./llm";
import { createNotification } from "@/lib/notifications";
import type { ReminderKind, ReminderFrequency, ReminderCandidate, ReminderRecord } from "./types";

const VALID_KINDS: ReminderKind[] = ["MEDICATION", "APPOINTMENT", "VITALS", "OTHER"];

export function describeSchedule(frequency: ReminderFrequency, nextFireAt: Date): string {
  let h = nextFireAt.getHours();
  const m = nextFireAt.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const time = `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
  if (frequency === "DAILY") return `every day at ${time}`;
  const date = nextFireAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `on ${date} at ${time}`;
}

export function computeNextFireAt(candidate: ReminderCandidate, now: Date): Date {
  if (candidate.frequency === "ONCE") {
    return new Date(candidate.isoDateTime ?? now);
  }
  const next = new Date(now);
  next.setHours(candidate.hour ?? 8, candidate.minute ?? 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

export async function detectReminder(userText: string, assistantText: string): Promise<ReminderCandidate | null> {
  const raw = await chat(
    [
      {
        role: "system",
        content:
          'Decide if the patient is asking to be reminded about something. If NOT, return exactly null. If YES, return ONLY a JSON object {"kind","label","frequency","hour","minute","isoDateTime"} where kind is MEDICATION|APPOINTMENT|VITALS|OTHER and frequency is DAILY or ONCE. For DAILY include hour (0-23) and minute (0-59). For ONCE include isoDateTime (ISO 8601). label is a short phrase like "take BP meds". No prose, no code fences.',
      },
      { role: "user", content: `Patient said: ${userText}\nAmelia replied: ${assistantText}` },
    ],
    { model: "gpt-4o-mini", temperature: 0, maxTokens: 200 }
  );

  let parsed: unknown;
  try {
    const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    if (cleaned === "null" || cleaned === "") return null;
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const c = parsed as Record<string, unknown>;
  if (!VALID_KINDS.includes(c.kind as ReminderKind)) return null;
  if (c.frequency !== "DAILY" && c.frequency !== "ONCE") return null;
  if (typeof c.label !== "string" || c.label.trim().length === 0) return null;

  const candidate: ReminderCandidate = {
    kind: c.kind as ReminderKind,
    label: (c.label as string).trim(),
    frequency: c.frequency as ReminderFrequency,
  };
  if (candidate.frequency === "DAILY") {
    candidate.hour = typeof c.hour === "number" ? c.hour : 8;
    candidate.minute = typeof c.minute === "number" ? c.minute : 0;
  } else {
    if (typeof c.isoDateTime !== "string") return null;
    candidate.isoDateTime = c.isoDateTime;
  }
  return candidate;
}
```

- [ ] **Step 4: Run** → `npx jest src/__tests__/lib/amelia/reminders-detect.test.ts` → PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/reminders.ts src/__tests__/lib/amelia/reminders-detect.test.ts
git commit -m "feat(amelia): reminder detection + deterministic scheduling (TDD)"
```

---

## Task 4: Reminder CRUD (TDD, mocked Prisma)

**Files:**
- Modify: `src/lib/amelia/reminders.ts` (append)
- Test: `src/__tests__/lib/amelia/reminders-crud.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/reminders-crud.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const create = jest.fn();
const findMany = jest.fn();
const updateMany = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { reminder: {
    create: (...a: unknown[]) => create(...a),
    findMany: (...a: unknown[]) => findMany(...a),
    updateMany: (...a: unknown[]) => updateMany(...a),
  } },
}));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));
jest.mock("@/lib/notifications", () => ({ createNotification: jest.fn() }));

import { createReminder, listReminders, cancelReminder } from "@/lib/amelia/reminders";

beforeEach(() => { create.mockReset(); findMany.mockReset(); updateMany.mockReset(); });

describe("reminder CRUD (patient-scoped)", () => {
  it("creates a reminder", async () => {
    create.mockResolvedValue({});
    const when = new Date(2026, 5, 12, 8, 0);
    await createReminder("pat1", { kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: when });
    expect(create).toHaveBeenCalledWith({ data: { patientId: "pat1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: when } });
  });

  it("lists active reminders with a human schedule", async () => {
    findMany.mockResolvedValue([{ id: "1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: new Date(2026, 5, 12, 8, 0) }]);
    const out = await listReminders("pat1");
    expect(out[0].schedule).toBe("every day at 8:00 AM");
    expect(out[0].id).toBe("1");
  });

  it("cancels scoped by id AND patientId", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await cancelReminder("r1", "pat1");
    expect(updateMany).toHaveBeenCalledWith({ where: { id: "r1", patientId: "pat1" }, data: { active: false } });
  });
});
```

- [ ] **Step 2: Run** → FAIL (functions not exported).

- [ ] **Step 3: Append to `src/lib/amelia/reminders.ts`**

```typescript

export async function createReminder(
  patientId: string,
  data: { kind: ReminderKind; label: string; frequency: ReminderFrequency; nextFireAt: Date }
): Promise<void> {
  await prisma.reminder.create({
    data: { patientId, kind: data.kind, label: data.label, frequency: data.frequency, nextFireAt: data.nextFireAt },
  });
}

export async function listReminders(patientId: string): Promise<ReminderRecord[]> {
  const rows = await prisma.reminder.findMany({ where: { patientId, active: true }, orderBy: { nextFireAt: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as ReminderKind,
    label: r.label,
    frequency: r.frequency as ReminderFrequency,
    nextFireAt: r.nextFireAt.toISOString(),
    schedule: describeSchedule(r.frequency as ReminderFrequency, r.nextFireAt),
  }));
}

export async function cancelReminder(id: string, patientId: string): Promise<void> {
  await prisma.reminder.updateMany({ where: { id, patientId }, data: { active: false } });
}
```

- [ ] **Step 4: Run** → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/reminders.ts src/__tests__/lib/amelia/reminders-crud.test.ts
git commit -m "feat(amelia): patient-scoped reminder CRUD (TDD)"
```

---

## Task 5: fireDueReminders (TDD, mocked Prisma + createNotification)

**Files:**
- Modify: `src/lib/amelia/reminders.ts` (append)
- Test: `src/__tests__/lib/amelia/reminders-fire.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/amelia/reminders-fire.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const findMany = jest.fn();
const update = jest.fn();
const createNotification = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: { reminder: { findMany: (...a: unknown[]) => findMany(...a), update: (...a: unknown[]) => update(...a) } },
}));
jest.mock("@/lib/notifications", () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }));
jest.mock("@/lib/amelia/llm", () => ({ chat: jest.fn() }));

import { fireDueReminders } from "@/lib/amelia/reminders";

beforeEach(() => { findMany.mockReset(); update.mockReset(); createNotification.mockReset(); });

describe("fireDueReminders", () => {
  it("notifies, advances DAILY, deactivates ONCE", async () => {
    const now = new Date(2026, 5, 12, 8, 5, 0);
    findMany.mockResolvedValue([
      { id: "d1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: new Date(2026, 5, 12, 8, 0) },
      { id: "o1", kind: "APPOINTMENT", label: "see Dr", frequency: "ONCE", nextFireAt: new Date(2026, 5, 12, 7, 0) },
    ]);
    update.mockResolvedValue({});
    createNotification.mockResolvedValue({});

    const fired = await fireDueReminders("pat1", "user1", now);

    expect(fired).toBe(2);
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification).toHaveBeenCalledWith("user1", "Reminder", "BP meds", "REMINDER", { link: "/patient/amelia" });
    // DAILY advanced to next day
    const dailyUpdate = update.mock.calls.find((c) => (c[0] as { where: { id: string } }).where.id === "d1")![0] as { data: { nextFireAt: Date } };
    expect(dailyUpdate.data.nextFireAt.getDate()).toBe(13);
    // ONCE deactivated
    const onceUpdate = update.mock.calls.find((c) => (c[0] as { where: { id: string } }).where.id === "o1")![0] as { data: { active: boolean } };
    expect(onceUpdate.data.active).toBe(false);
  });

  it("returns 0 when nothing is due", async () => {
    findMany.mockResolvedValue([]);
    expect(await fireDueReminders("pat1", "user1", new Date(2026, 5, 12, 8, 0))).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Append to `src/lib/amelia/reminders.ts`**

```typescript

export async function fireDueReminders(patientId: string, userId: string, now: Date = new Date()): Promise<number> {
  const due = await prisma.reminder.findMany({ where: { patientId, active: true, nextFireAt: { lte: now } } });
  for (const r of due) {
    await createNotification(userId, "Reminder", r.label, "REMINDER", { link: "/patient/amelia" });
    if (r.frequency === "DAILY") {
      const next = new Date(r.nextFireAt);
      while (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
      await prisma.reminder.update({ where: { id: r.id }, data: { nextFireAt: next } });
    } else {
      await prisma.reminder.update({ where: { id: r.id }, data: { active: false } });
    }
  }
  return due.length;
}
```

- [ ] **Step 4: Run** → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/amelia/reminders.ts src/__tests__/lib/amelia/reminders-fire.test.ts
git commit -m "feat(amelia): fireDueReminders — notify + advance/deactivate (TDD)"
```

---

## Task 6: Chat route returns reminderSuggestion (TDD — update existing test)

**Files:**
- Modify: `src/app/api/amelia/chat/route.ts`
- Modify: `src/__tests__/api/amelia/chat.test.ts`

- [ ] **Step 1: Update the chat test.** In `src/__tests__/api/amelia/chat.test.ts`, after the existing `jest.mock("@/lib/amelia/memory", ...)` block, ADD a reminders mock:

```typescript
const detectReminder = jest.fn();
jest.mock("@/lib/amelia/reminders", () => ({
  detectReminder: (...a: unknown[]) => detectReminder(...a),
  computeNextFireAt: () => new Date(2026, 5, 12, 8, 0),
  describeSchedule: () => "every day at 8:00 AM",
}));
```

In `beforeEach`, add `detectReminder.mockReset();` and a default `detectReminder.mockResolvedValue(null);`.

Then add a new test inside the describe block:

```typescript
  it("includes a reminderSuggestion when a reminder is detected", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub-1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    convoCreate.mockResolvedValue({ id: "c1" });
    msgCreate.mockResolvedValue({ id: "um1" });
    msgFindMany.mockResolvedValue([{ role: "user", content: "remind me to take meds at 8" }]);
    runAmeliaTurn.mockResolvedValue({ content: "Sure!", urgency: "routine", redFlags: [], disclaimer: "d" });
    detectReminder.mockResolvedValue({ kind: "MEDICATION", label: "take meds", frequency: "DAILY", hour: 8, minute: 0 });

    const res = await POST(req({ message: "remind me to take meds at 8" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.reminderSuggestion).toBeTruthy();
    expect(json.reminderSuggestion.label).toBe("take meds");
    expect(json.reminderSuggestion.schedule).toBe("every day at 8:00 AM");
  });
```

- [ ] **Step 2: Run** → `npx jest src/__tests__/api/amelia/chat.test.ts` → the new test FAILS (route doesn't return reminderSuggestion yet).

- [ ] **Step 3: Update `src/app/api/amelia/chat/route.ts`.** Add the import after the memory import:

```typescript
import { extractMemories, saveMemories } from "@/lib/amelia/memory";
import { detectReminder, computeNextFireAt, describeSchedule } from "@/lib/amelia/reminders";
```

After the memory try/catch block (the one ending `console.error("Amelia memory extraction failed:", memErr); }`) and BEFORE the `logAmeliaAudit(...)` call, INSERT:

```typescript
    // Phase 2 reminders: detect a reminder request and propose it (patient confirms).
    let reminderSuggestion: {
      kind: string; label: string; frequency: string; nextFireAt: string; schedule: string;
    } | null = null;
    try {
      const candidate = await detectReminder(message, reply.content);
      if (candidate) {
        const nextFireAt = computeNextFireAt(candidate, new Date());
        reminderSuggestion = {
          kind: candidate.kind,
          label: candidate.label,
          frequency: candidate.frequency,
          nextFireAt: nextFireAt.toISOString(),
          schedule: describeSchedule(candidate.frequency, nextFireAt),
        };
      }
    } catch (remErr) {
      console.error("Amelia reminder detection failed:", remErr);
    }
```

Change the success return from:

```typescript
    return NextResponse.json({ conversationId: convo.id, reply });
```

to:

```typescript
    return NextResponse.json({ conversationId: convo.id, reply, reminderSuggestion });
```

- [ ] **Step 4: Run** → `npx jest src/__tests__/api/amelia/chat.test.ts` → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/amelia/chat/route.ts src/__tests__/api/amelia/chat.test.ts
git commit -m "feat(amelia): chat route proposes a reminder when detected (TDD)"
```

---

## Task 7: Notifications route fires due reminders (TDD)

**Files:**
- Modify: `src/app/api/notifications/route.ts`
- Test: `src/__tests__/api/amelia/notifications-fire.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/api/amelia/notifications-fire.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
const notifFindMany = jest.fn();
const notifCount = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    notification: { findMany: (...a: unknown[]) => notifFindMany(...a), count: (...a: unknown[]) => notifCount(...a) },
  },
}));
const fireDueReminders = jest.fn();
jest.mock("@/lib/amelia/reminders", () => ({ fireDueReminders: (...a: unknown[]) => fireDueReminders(...a) }));

import { GET } from "@/app/api/notifications/route";

function req() {
  return new Request("http://localhost/api/notifications") as never;
}

beforeEach(() => [getUser, userFindUnique, notifFindMany, notifCount, fireDueReminders].forEach((m) => m.mockReset()));

describe("GET /api/notifications fires reminders for patients", () => {
  it("calls fireDueReminders with patientId + userId then returns notifications", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    fireDueReminders.mockResolvedValue(1);
    notifFindMany.mockResolvedValue([{ id: "n1" }]);
    notifCount.mockResolvedValue(1);

    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(fireDueReminders).toHaveBeenCalledWith("pat1", "u1");
    expect(json.notifications).toHaveLength(1);
  });

  it("does not fire for non-patients (no patient profile)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: null });
    notifFindMany.mockResolvedValue([]);
    notifCount.mockResolvedValue(0);

    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(fireDueReminders).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** → FAIL (route doesn't call fireDueReminders / doesn't include patient).

- [ ] **Step 3: Update `src/app/api/notifications/route.ts`.** Add the import at the top (after the existing imports):

```typescript
import { fireDueReminders } from "@/lib/amelia/reminders";
```

In the `GET` handler, change the user lookup to include the patient:

```typescript
    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });
```

to:

```typescript
    const user = await prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      include: { patient: true },
    });
```

Then, immediately after the `if (!user) { ... }` guard and BEFORE `const { searchParams } = new URL(req.url);`, INSERT:

```typescript
    // Lazily fire any due reminders for patients before listing notifications.
    if (user.patient) {
      try {
        await fireDueReminders(user.patient.id, user.id);
      } catch (remErr) {
        console.error("fireDueReminders failed:", remErr);
      }
    }
```

- [ ] **Step 4: Run** → `npx jest src/__tests__/api/amelia/notifications-fire.test.ts` → PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/notifications/route.ts src/__tests__/api/amelia/notifications-fire.test.ts
git commit -m "feat(amelia): notifications route lazily fires due reminders (TDD)"
```

---

## Task 8: Reminder API routes (TDD)

**Files:**
- Create: `src/app/api/amelia/reminders/route.ts` (POST + GET)
- Create: `src/app/api/amelia/reminders/[id]/route.ts` (DELETE)
- Test: `src/__tests__/api/amelia/reminders.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/api/amelia/reminders.test.ts
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

const getUser = jest.fn();
jest.mock("@/lib/supabase-server", () => ({ createServerSupabaseClient: () => ({ auth: { getUser: () => getUser() } }) }));
const userFindUnique = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: (...a: unknown[]) => userFindUnique(...a) } } }));
const createReminder = jest.fn();
const listReminders = jest.fn();
const cancelReminder = jest.fn();
jest.mock("@/lib/amelia/reminders", () => ({
  createReminder: (...a: unknown[]) => createReminder(...a),
  listReminders: (...a: unknown[]) => listReminders(...a),
  cancelReminder: (...a: unknown[]) => cancelReminder(...a),
}));

import { POST, GET } from "@/app/api/amelia/reminders/route";
import { DELETE } from "@/app/api/amelia/reminders/[id]/route";

function req(body?: unknown) {
  return new Request("http://localhost/api/amelia/reminders", { method: "POST", body: body ? JSON.stringify(body) : undefined }) as never;
}
const ctx = (id: string) => ({ params: { id } });

beforeEach(() => [getUser, userFindUnique, createReminder, listReminders, cancelReminder].forEach((m) => m.mockReset()));

describe("reminders API", () => {
  it("POST 401s when unauthenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await POST(req({}))).status).toBe(401);
  });

  it("POST creates a reminder for the patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    createReminder.mockResolvedValue(undefined);
    const iso = new Date(2026, 5, 12, 8, 0).toISOString();
    const res = await POST(req({ kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: iso }));
    expect(res.status).toBe(200);
    expect(createReminder).toHaveBeenCalledTimes(1);
    const [pid, data] = createReminder.mock.calls[0] as [string, { label: string; nextFireAt: Date }];
    expect(pid).toBe("pat1");
    expect(data.label).toBe("BP meds");
    expect(data.nextFireAt instanceof Date).toBe(true);
  });

  it("GET lists the patient's reminders", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    listReminders.mockResolvedValue([{ id: "1", kind: "MEDICATION", label: "BP meds", frequency: "DAILY", nextFireAt: "x", schedule: "every day at 8:00 AM" }]);
    const res = await GET(req());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.reminders[0].label).toBe("BP meds");
    expect(listReminders).toHaveBeenCalledWith("pat1");
  });

  it("DELETE cancels scoped to the patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "sub1" } } });
    userFindUnique.mockResolvedValue({ id: "u1", patient: { id: "pat1" } });
    cancelReminder.mockResolvedValue(undefined);
    const res = await DELETE(req(), ctx("r1"));
    expect(res.status).toBe(200);
    expect(cancelReminder).toHaveBeenCalledWith("r1", "pat1");
  });
});
```

- [ ] **Step 2: Run** → FAIL (modules not found).

- [ ] **Step 3: Create `src/app/api/amelia/reminders/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { createReminder, listReminders } from "@/lib/amelia/reminders";

async function getPatientId(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
  return user?.patient?.id ?? null;
}

const createSchema = z.object({
  kind: z.enum(["MEDICATION", "APPOINTMENT", "VITALS", "OTHER"]),
  label: z.string().min(1).max(200),
  frequency: z.enum(["ONCE", "DAILY"]),
  nextFireAt: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  try {
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = createSchema.parse(await req.json());
    await createReminder(patientId, {
      kind: body.kind,
      label: body.label,
      frequency: body.frequency,
      nextFireAt: new Date(body.nextFireAt),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 422 });
    }
    console.error("Reminder POST error:", error);
    return NextResponse.json({ error: "Failed to create reminder." }, { status: 500 });
  }
}

export async function GET() {
  const patientId = await getPatientId();
  if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const reminders = await listReminders(patientId);
  return NextResponse.json({ reminders });
}
```

- [ ] **Step 4: Create `src/app/api/amelia/reminders/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { cancelReminder } from "@/lib/amelia/reminders";

async function getPatientId(): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const user = await prisma.user.findUnique({ where: { supabaseId: authUser.id }, include: { patient: true } });
  return user?.patient?.id ?? null;
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const patientId = await getPatientId();
    if (!patientId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await cancelReminder(params.id, patientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reminder DELETE error:", error);
    return NextResponse.json({ error: "Failed to cancel reminder." }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run** → PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/amelia/reminders/route.ts "src/app/api/amelia/reminders/[id]/route.ts" src/__tests__/api/amelia/reminders.test.ts
git commit -m "feat(amelia): reminder API routes — create, list, cancel (TDD)"
```

---

## Task 9: ReminderCard component (TDD, jsdom)

**Files:**
- Create: `src/components/amelia/ReminderCard.tsx`
- Test: `src/__tests__/components/amelia/ReminderCard.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/amelia/ReminderCard.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ReminderCard from "@/components/amelia/ReminderCard";

const suggestion = { kind: "MEDICATION", label: "take BP meds", frequency: "DAILY", nextFireAt: "2026-06-12T08:00:00.000Z", schedule: "every day at 8:00 AM" };

beforeEach(() => {
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as unknown as jest.Mock;
});

describe("ReminderCard", () => {
  it("shows the proposed schedule and a Set button", () => {
    render(<ReminderCard suggestion={suggestion} />);
    expect(screen.getByText(/take BP meds/)).toBeInTheDocument();
    expect(screen.getByText(/every day at 8:00 AM/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set reminder/i })).toBeInTheDocument();
  });

  it("POSTs and shows confirmation on Set", async () => {
    render(<ReminderCard suggestion={suggestion} />);
    fireEvent.click(screen.getByRole("button", { name: /set reminder/i }));
    await waitFor(() => expect(screen.getByText(/Reminder set/i)).toBeInTheDocument());
    expect((global as unknown as { fetch: jest.Mock }).fetch).toHaveBeenCalledWith("/api/amelia/reminders", expect.objectContaining({ method: "POST" }));
  });

  it("dismisses on Not now", () => {
    const { container } = render(<ReminderCard suggestion={suggestion} />);
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Create `src/components/amelia/ReminderCard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { BellPlus, Check } from "lucide-react";

export interface ReminderSuggestionUI {
  kind: string;
  label: string;
  frequency: string;
  nextFireAt: string;
  schedule: string;
}

export default function ReminderCard({ suggestion }: { suggestion: ReminderSuggestionUI }) {
  const [state, setState] = useState<"idle" | "saving" | "done" | "dismissed">("idle");

  const setReminder = async () => {
    setState("saving");
    try {
      const res = await fetch("/api/amelia/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: suggestion.kind,
          label: suggestion.label,
          frequency: suggestion.frequency,
          nextFireAt: suggestion.nextFireAt,
        }),
      });
      setState(res.ok ? "done" : "idle");
    } catch {
      setState("idle");
    }
  };

  if (state === "dismissed") return null;

  return (
    <div className="mx-2 my-1 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/5 px-4 py-3">
      {state === "done" ? (
        <p className="flex items-center gap-2 text-sm text-green-700">
          <Check className="w-4 h-4" /> Reminder set — {suggestion.schedule}.
        </p>
      ) : (
        <>
          <p className="flex items-center gap-2 text-sm text-gray-800 mb-2">
            <BellPlus className="w-4 h-4 text-[var(--primary)]" />
            Remind you to <span className="font-medium">{suggestion.label}</span>, {suggestion.schedule}?
          </p>
          <div className="flex gap-2">
            <button
              onClick={setReminder}
              disabled={state === "saving"}
              className="text-xs font-medium text-white bg-[var(--primary)] px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {state === "saving" ? "Setting…" : "Set reminder"}
            </button>
            <button
              onClick={() => setState("dismissed")}
              className="text-xs font-medium text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100"
            >
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run** → PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/amelia/ReminderCard.tsx src/__tests__/components/amelia/ReminderCard.test.tsx
git commit -m "feat(amelia): inline ReminderCard confirmation (TDD)"
```

---

## Task 10: Render ReminderCard in AmeliaChat (TDD, jsdom)

**Files:**
- Modify: `src/components/amelia/AmeliaChat.tsx`
- Test: `src/__tests__/components/amelia/AmeliaChat-reminder.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/__tests__/components/amelia/AmeliaChat-reminder.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock("@/components/chat/ChatMessage", () => ({ __esModule: true, default: ({ content }: { content: string }) => <div>{content}</div> }));
jest.mock("@/components/chat/TypingIndicator", () => ({ __esModule: true, default: () => <div /> }));
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
    json: async () => ({
      conversationId: "c1",
      reply: { content: "Sure!", urgency: "routine", redFlags: [], disclaimer: "d" },
      reminderSuggestion: { kind: "MEDICATION", label: "take meds", frequency: "DAILY", nextFireAt: "2026-06-12T08:00:00.000Z", schedule: "every day at 8:00 AM" },
    }),
  })) as unknown as jest.Mock;
});

describe("AmeliaChat reminder card", () => {
  it("renders a ReminderCard when the reply carries a reminderSuggestion", async () => {
    render(<AmeliaChat />);
    fireEvent.change(screen.getByLabelText("message"), { target: { value: "remind me to take meds at 8" } });
    fireEvent.click(screen.getByText("send"));
    await waitFor(() => expect(screen.getByText(/take meds/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /set reminder/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Replace `src/components/amelia/AmeliaChat.tsx`** with (adds `reminderSuggestion` to messages + renders `ReminderCard`):

```tsx
"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import ChatMessage from "@/components/chat/ChatMessage";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ReminderCard, { type ReminderSuggestionUI } from "@/components/amelia/ReminderCard";
import { PATIENT_DISCLAIMER } from "@/lib/amelia/safety";

interface UiMessage {
  role: "user" | "assistant";
  content: string;
  sentAt: string;
  reminderSuggestion?: ReminderSuggestionUI;
}

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
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data.reply.content, sentAt: new Date().toISOString(), reminderSuggestion: data.reminderSuggestion ?? undefined },
        ]);
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
          <div key={i}>
            <ChatMessage isMine={m.role === "user"} content={m.content} sentAt={m.sentAt} otherInitials="A" />
            {m.reminderSuggestion && <ReminderCard suggestion={m.reminderSuggestion} />}
          </div>
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

- [ ] **Step 4: Run** → `npx jest src/__tests__/components/amelia/AmeliaChat-reminder.test.tsx src/__tests__/components/amelia/AmeliaChat.test.tsx` → PASS (new + existing AmeliaChat tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/amelia/AmeliaChat.tsx src/__tests__/components/amelia/AmeliaChat-reminder.test.tsx
git commit -m "feat(amelia): render the reminder card inline in chat (TDD)"
```

---

## Task 11: Reminders tab (TDD, jsdom)

**Files:**
- Create: `src/components/amelia/AmeliaRemindersPanel.tsx`
- Modify: `src/components/amelia/AmeliaTabs.tsx`
- Test: `src/__tests__/components/amelia/AmeliaRemindersPanel.test.tsx`
- Test: `src/__tests__/components/amelia/AmeliaTabs.test.tsx` (update — add the third tab assertion)

- [ ] **Step 1: Write the panel's failing test**

```tsx
// src/__tests__/components/amelia/AmeliaRemindersPanel.test.tsx
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AmeliaRemindersPanel from "@/components/amelia/AmeliaRemindersPanel";

function mockFetch() {
  const calls: { url: string; method: string }[] = [];
  (global as unknown as { fetch: jest.Mock }).fetch = jest.fn(async (url: string, opts?: { method?: string }) => {
    calls.push({ url, method: opts?.method ?? "GET" });
    if ((opts?.method ?? "GET") === "GET") {
      return { ok: true, json: async () => ({ reminders: [{ id: "1", kind: "MEDICATION", label: "take BP meds", frequency: "DAILY", nextFireAt: "x", schedule: "every day at 8:00 AM" }] }) };
    }
    return { ok: true, json: async () => ({ ok: true }) };
  }) as unknown as jest.Mock;
  return calls;
}

beforeEach(() => mockFetch());

describe("AmeliaRemindersPanel", () => {
  it("lists active reminders with their schedule", async () => {
    render(<AmeliaRemindersPanel />);
    await waitFor(() => expect(screen.getByText("take BP meds")).toBeInTheDocument());
    expect(screen.getByText("every day at 8:00 AM")).toBeInTheDocument();
  });

  it("cancels a reminder via DELETE", async () => {
    const calls = mockFetch();
    render(<AmeliaRemindersPanel />);
    await waitFor(() => expect(screen.getByText("take BP meds")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/api/amelia/reminders/1"))).toBe(true));
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Create `src/components/amelia/AmeliaRemindersPanel.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Trash2, Loader2 } from "lucide-react";

interface ReminderRecord {
  id: string;
  kind: string;
  label: string;
  frequency: string;
  nextFireAt: string;
  schedule: string;
}

export default function AmeliaRemindersPanel() {
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/amelia/reminders");
      const data = await res.json();
      if (res.ok) setReminders(data.reminders ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (id: string) => {
    await fetch(`/api/amelia/reminders/${id}`, { method: "DELETE" });
    await load();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (reminders.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-12 px-4">
        No reminders yet — just ask Amelia to remind you about anything.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto px-4 py-4 space-y-2">
      {reminders.map((r) => (
        <div key={r.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2">
          <Bell className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800">{r.label}</p>
            <p className="text-xs text-gray-400">{r.schedule}</p>
          </div>
          <button onClick={() => cancel(r.id)} aria-label="Cancel" className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run** → `npx jest src/__tests__/components/amelia/AmeliaRemindersPanel.test.tsx` → PASS (2 tests).

- [ ] **Step 5: Update the tabs test.** Replace `src/__tests__/components/amelia/AmeliaTabs.test.tsx` with:

```tsx
// src/__tests__/components/amelia/AmeliaTabs.test.tsx
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";

jest.mock("@/components/amelia/AmeliaChat", () => ({ __esModule: true, default: () => <div data-testid="chat" /> }));
jest.mock("@/components/amelia/AmeliaMemoryPanel", () => ({ __esModule: true, default: () => <div data-testid="panel" /> }));
jest.mock("@/components/amelia/AmeliaRemindersPanel", () => ({ __esModule: true, default: () => <div data-testid="reminders" /> }));

import AmeliaTabs from "@/components/amelia/AmeliaTabs";

describe("AmeliaTabs", () => {
  it("switches between chat, memory, and reminders", () => {
    render(<AmeliaTabs />);
    expect(screen.getByTestId("chat")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /what amelia knows/i }));
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reminders/i }));
    expect(screen.getByTestId("reminders")).toBeInTheDocument();
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run** → FAIL (no reminders tab yet).

- [ ] **Step 7: Replace `src/components/amelia/AmeliaTabs.tsx`**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import AmeliaChat from "./AmeliaChat";
import AmeliaMemoryPanel from "./AmeliaMemoryPanel";
import AmeliaRemindersPanel from "./AmeliaRemindersPanel";

type Tab = "chat" | "memory" | "reminders";

export default function AmeliaTabs() {
  const [tab, setTab] = useState<Tab>("chat");

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={cn(
        "px-4 py-1.5 text-sm font-medium rounded-lg transition",
        tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-3 self-start">
        {tabBtn("chat", "Chat")}
        {tabBtn("memory", "What Amelia knows")}
        {tabBtn("reminders", "Reminders")}
      </div>
      <div className="flex-1 min-h-0 rounded-2xl border border-gray-100 overflow-hidden">
        {tab === "chat" && <AmeliaChat />}
        {tab === "memory" && <AmeliaMemoryPanel />}
        {tab === "reminders" && <AmeliaRemindersPanel />}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run** → `npx jest src/__tests__/components/amelia/AmeliaTabs.test.tsx` → PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add src/components/amelia/AmeliaRemindersPanel.tsx src/components/amelia/AmeliaTabs.tsx src/__tests__/components/amelia/AmeliaRemindersPanel.test.tsx src/__tests__/components/amelia/AmeliaTabs.test.tsx
git commit -m "feat(amelia): Reminders tab (panel + third tab) (TDD)"
```

---

## Task 12: End-of-phase verification, DB push, graph, tag

**Files:** none (verification + ops)

- [ ] **Step 1: Full quality gate**

Run: `npx tsc --noEmit -p . && npm test && npm run build`
Expected: tsc clean; all tests pass; production build succeeds.

- [ ] **Step 2: Push schema** (REQUIRES Supabase restored)

Run: `npx prisma db push`
Expected: "Your database is now in sync" — creates `reminders`.

> If Supabase is still down, STOP and restore it first. Code + tests are green without it.

- [ ] **Step 3: Manual smoke** (valid `OPENAI_API_KEY` + DB up, as the seeded patient)

On `/patient/amelia`, chat: "remind me to take my BP meds every morning at 8." Expect an inline card "Remind you to take BP meds, every day at 8:00 AM?" → tap **Set reminder** → "✓ Reminder set." Open the **Reminders** tab → it's listed. To test firing, create a reminder with a time a minute in the past (or set the DB row's `next_fire_at` to now), then reload — the notification bell shows the reminder; the DAILY row's `next_fire_at` advanced a day. Cancel a reminder → it disappears.

- [ ] **Step 4: Update the graph**

Run: `graphify update "C:\Users\IKA\Nala Vita"`

- [ ] **Step 5: Tag**

```bash
git tag amelia-phase-2-reminders-complete
```

---

## Self-Review Coverage Map (spec → task)

| Spec requirement | Task |
|---|---|
| `Reminder` model (ONCE\|DAILY) | 1 |
| Reminder types | 2 |
| `detectReminder` (gpt-4o-mini) + `computeNextFireAt` + `describeSchedule` | 3 |
| `createReminder` / `listReminders` / `cancelReminder` (patient-scoped) | 4 |
| `fireDueReminders` (notify + advance DAILY / deactivate ONCE) | 5 |
| Chat route returns `reminderSuggestion` (full create payload + schedule) | 6 |
| Lazy firing from `GET /api/notifications` (patients only) | 7 |
| Reminder API (POST create, GET list, DELETE cancel) | 8 |
| Inline confirmation card | 9, 10 |
| Reminders tab (view/cancel only) | 11 |

**Deferred (per spec §10):** WEEKLY/custom frequencies, cron/web-push delivery, editing, snooze; medication coach + lab-photo OCR (separate sub-projects).
