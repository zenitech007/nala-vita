# Amelia Phase 2 — Long-Term Memory Design Spec

- **Date:** 2026-06-09
- **Status:** Approved (design); ready for implementation planning
- **Parent design:** `docs/superpowers/specs/2026-06-08-amelia-ai-assistant-design.md`
- **Builds on:** Phase 1 (merged to `main`, tag `amelia-phase-1-complete`) — the
  `src/lib/amelia/` engine, the chat route, and the `/patient/amelia` page.
- **Scope of this spec:** Long-term **memory** only — the first of five Phase 2
  sub-features. The other four (reminders, medication coach, lab-photo OCR,
  proactive dashboard card) are separate sub-projects with their own specs.

> **Runtime caveat:** Phase 1 is code-complete and unit-tested but not yet
> runtime-verified (Supabase was DNS-down on 2026-06-08; `prisma db push` and
> a live LLM smoke are still pending). Phase 2 is built on the same
> build-now-verify-later basis and will be smoke-tested together with Phase 1
> once Supabase is restored.

---

## 1. Goal

Make Amelia *remember* a patient across conversations. She extracts durable
facts (allergies, chronic conditions, preferences) from chats, recalls them in
future turns, and the patient can review/correct them in a "What Amelia knows
about me" panel. This is the headline "stands out" differentiator from the
parent design.

## 2. Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| First Phase 2 sub-feature | **Long-term memory** |
| Trust model | **Hybrid by stakes** — low-stakes facts (preference, lifestyle) used immediately; high-stakes facts (allergy, condition, medication) stored but **confirmed before Amelia relies on them** |
| Extraction mechanism | **Post-turn extraction pass** with **gpt-4o-mini** (cheap, decoupled from the main reply, deterministic, testable) |
| Confirmation surface | The **panel** is authoritative (explicit confirm/edit/delete). Conversational auto-confirm is deferred |
| Doctor visibility of memory | **Deferred to Phase 3** (doctor copilot) |

## 3. Data model

New Prisma model (additive):

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

`prisma db push` is deferred (Supabase down); `prisma generate` is offline-safe
and gives the TypeScript types. Tests mock Prisma.

**Stakes are derived from `kind`, not stored** (DRY): ALLERGY, CONDITION,
MEDICATION are high-stakes; PREFERENCE, LIFESTYLE, OTHER are low-stakes.

## 4. `src/lib/amelia/memory.ts`

Each function has one responsibility and is independently testable:

- `isHighStakes(kind: string): boolean` — pure classifier.
- `extractMemories(userText, assistantText): Promise<Candidate[]>` — one
  **gpt-4o-mini** call (via the existing `llm.ts` wrapper, extended to allow a
  model override) returning structured `{ kind, value }[]`. Mockable.
- `saveMemories(patientId, candidates, sourceMessageId?): Promise<void>` —
  dedupe against existing rows (case-insensitive on `kind`+`value`); insert new.
  **Low-stakes → `confirmedByUser=true`** (usable immediately);
  **high-stakes → `confirmedByUser=false`** (pending).
- `getMemoriesForGrounding(patientId): Promise<{ known: Mem[]; toConfirm: Mem[] }>`
  — `known` = low-stakes (all) + high-stakes confirmed; `toConfirm` =
  high-stakes unconfirmed.
- `listMemories(patientId)`, `confirmMemory(id, patientId)`,
  `updateMemory(id, patientId, value)`, `deleteMemory(id, patientId)` — panel
  operations (each scoped to the owning patient).

## 5. Engine integration (recall) — extend Phase 1

- **Recall (read):** `runAmeliaTurn` loads grounding memories
  (`getMemoriesForGrounding`) alongside the Phase 1 EHR context.
- `prompts.ts` `patientAdvisorPrompt` gains two optional blocks:
  - **"Known about this patient (from memory):"** — the `known` set, treated as
    fact.
  - **"To gently confirm — do NOT rely on until the patient confirms:"** — the
    `toConfirm` set, with instruction to raise them softly and point the patient
    to the "What Amelia knows" panel.
- **Extraction (write):** stays OUT of the engine to keep the reply fast. After
  the chat **route** (`/api/amelia/chat`) persists Amelia's reply, it calls
  `extractMemories` + `saveMemories` on that exchange, awaited (serverless-safe).

Clean split: the engine *reads* memory for grounding; the route *writes* memory
after the turn. Each side is tested independently.

## 6. Memory API

All auth-gated; every operation verifies the memory's `patientId` matches the
requesting user's patient.

- `GET /api/amelia/memory` → the patient's memories grouped by kind.
- `PATCH /api/amelia/memory/[id]` → body `{ action: "confirm" }`
  (set `confirmedByUser=true`) **or** `{ value: string }` (edit the value).
- `DELETE /api/amelia/memory/[id]` → remove a memory.

## 7. UI — "What Amelia knows" panel

- `src/components/amelia/AmeliaMemoryPanel.tsx` (client). Lists memories grouped
  by kind (Allergies · Conditions · Medications · Preferences · Lifestyle), each
  with a **confirmed ✓ / pending** badge. High-stakes **pending** items get a
  prominent **"Confirm"** button plus edit/delete; others get edit/delete.
  Empty state: *"Amelia hasn't learned anything yet — chat with her and she'll
  start remembering."*
- `/patient/amelia/page.tsx` gains a **two-tab toggle: "Chat" | "What Amelia
  knows"** (mobile-friendly, no split-layout complexity). The chat tab is the
  Phase 1 `AmeliaChat`; the second tab renders `AmeliaMemoryPanel`.

## 8. Safety & cost

- Extraction = one gpt-4o-mini call per turn, deduped → minimal added cost; the
  main reply stays on gpt-4o and stays fast.
- Memory values are medical PHI **by design** — stored in the patient's own
  row, protected by the **RLS policies already applied** (a patient reads/writes
  only their own memories). The extraction **audit log is PHI-stripped** (records
  counts/kinds, never values).
- **High-stakes facts never silently drive advice** — they stay in the
  "to confirm" block until the patient confirms via the panel. This is the core
  safety guarantee of the hybrid model.

## 9. Testing

- `memory.ts`: `isHighStakes` (pure); `extractMemories` (mock `llm`);
  `saveMemories` (mock Prisma — dedupe + stakes→confirmed logic);
  `getMemoriesForGrounding` (mock Prisma — known/toConfirm split);
  confirm/update/delete (mock Prisma — patient-scoping).
- `prompts.ts`: the new known/toConfirm blocks render (pure).
- 3 memory API routes: auth gate + happy path (mocked).
- `AmeliaMemoryPanel`: jsdom, mocked fetch — renders groups, confirm + delete
  actions fire the right requests.

## 10. Out of scope (this sub-project)

- Reminders, medication coach, lab-photo OCR, proactive dashboard card (separate
  Phase 2 sub-projects).
- Doctor-side visibility of memory (Phase 3).
- Conversational auto-confirmation of high-stakes facts (later refinement).
- Vector / semantic memory retrieval — the structured `AmeliaMemory` table is
  injected wholesale (a patient's durable-fact set is small); RAG is unnecessary.
