# Amelia AI Assistant — Design Spec

- **Date:** 2026-06-08
- **Status:** Approved (design); ready for implementation planning
- **Scope of this spec:** The Amelia AI assistant subsystem only.
  Two sibling subsystems were identified and deferred to their own specs:
  (2) solo-patient onboarding/positioning — mostly *delivered by* Amelia,
  finalized once Phase 1 lands; (3) medical-records request + consent flow —
  independent workflow, separate spec.

---

## 1. Problem

The MediConnect pivot stripped the original "Amelia" AI down to almost
nothing. Evidence from the live codebase:

- Only 3 AI routes exist, all thin: `symptom-check` (148 LOC),
  `diagnosis-support` (209), `risk-score` (217).
- Two are **orphaned** — nothing in the UI calls `diagnosis-support` or
  `risk-score`.
- One UI call is **broken**: `patient/lab-results/page.tsx` fetches
  `/api/ai/lab-summary`, a route that does not exist.
- There is **no conversational Amelia** — no chat-with-AI, no memory, no
  personality. The chat system is human↔human only.
- The real Amelia survives only as **reference** in `.amelia-source/`:
  `lib/ai.ts` (brain), `lib/memory.ts` + `classifyMemory.ts` (long-term
  memory), `app/ai-chat/`, `components/AmeliaAlert.tsx`, `public/amelia.png`,
  seeded medical knowledge. It was left behind to drop the Python backend.

**Goal:** resurrect Amelia into the no-Python MediConnect architecture and
make her substantially more capable — a single, grounded, safe assistant
with a patient face and a doctor face.

## 2. Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Build order | **Amelia first**; solo-patient layer + records flow follow |
| Patient autonomy tier | **Advisor** — names likely conditions, recommends OTC/self-care, interprets labs/vitals in plain language, always closes with "confirm with a doctor"; red-flag emergencies hard-stop in every tier |
| Doctor copilot scope | **All four** — draft consultation notes, pre-visit summary, differential + decision support, prescription safety net |
| Patient powers | **All four + reminders** — symptom triage + action plan, lab & vitals interpreter, medication coach, long-term memory (memory *is* the 4th power), plus reminders added by the user |
| LLM provider | **OpenAI gpt-4o** (only `OPENAI_API_KEY` is set; existing routes use it). Swappable later |
| Architecture | **One grounded brain + tool-calling** — single engine, real-data tools, two system prompts |

## 3. Architecture — one engine, two faces

New module `src/lib/amelia/`:

```
src/lib/amelia/
  engine.ts      core: (audience, conversation, message) -> streamed grounded reply
  prompts.ts     two system prompts: patientAdvisor + doctorCopilot
  safety.ts      red-flag detection, disclaimer injection, PHI guard
  memory.ts      extract & recall durable facts (allergies, chronic conditions)
  tools/         Amelia's "hands" — each reads real data or takes an action
    getPatientContext.ts      vitals, meds, labs, appts, allergies (real Postgres data)
    interpretLab.ts           plain-language lab explanation (+ photo OCR, Phase 2)
    setReminder.ts            writes a Reminder + Notification
    checkPrescriptionSafety.ts drug interactions, dosing, allergy conflicts
    draftConsultationNote.ts  transcript -> SOAP note (doctor face)
    flagEmergency.ts          escalation hook
    saveMemory.ts / getMemory.ts
```

**Patient turn (worked example — why tool-calling = safe):**

1. Patient: *"Headache + blurry vision for 2 days."*
2. Engine calls `getPatientContext` → pulls the patient's **real** recent
   vitals, meds, conditions from Postgres.
3. `safety.ts` scans for red flags — if the last recorded BP was high,
   headache + blurry vision → **escalate to "seek emergency care."**
4. gpt-4o (patientAdvisor prompt + grounded context) → urgency triage,
   likely causes, a plan, "confirm with a doctor."
5. If she acts (set a med reminder) she calls `setReminder` → writes a row.
6. Whole exchange → `AuditLog`.

When Amelia says *"your lisinopril could be causing that cough,"* it is
because `getPatientContext` **actually returned lisinopril** — not a guess.
The same engine powers the doctor face via the `doctorCopilot` prompt (full
clinical language, no patient-safety hedging).

## 4. Data model (all additive — no breaking changes)

New Prisma models:

| Model | Purpose |
|---|---|
| `AmeliaConversation` | a chat thread: `patientId?` / `doctorId?`, `audience`, timestamps |
| `AmeliaMessage` | `role` (user/assistant/tool), `content`, `toolCalls`, `conversationId` |
| `AmeliaMemory` | durable facts: `patientId`, `kind` (ALLERGY/CONDITION/PREFERENCE/HISTORY), `value`, `confidence`, `sourceMessageId`, `confirmedByUser`, timestamps. Surfaced to doctors |
| `Reminder` | `patientId`, `kind` (MEDICATION/APPOINTMENT/VITALS), `schedule`, `nextFireAt`, `active` |

Reuse existing models: `Notification` + `createNotification()` (how reminders
and alerts reach the user in-app), `AuditLog` (every interaction logged),
`FileUpload` (lab photos for the interpreter).

## 5. Patient experience (this is the solo-patient value)

**Three surfaces:**

1. **Floating "Ask Amelia" launcher** — bottom-right on every patient page,
   slide-in chat panel. Reuses existing `ChatMessage` / `ChatInput` /
   `TypingIndicator` components + avatar `public/amelia.png`.
2. **Dedicated `/patient/amelia` page** — full chat, conversation history,
   and a **"What Amelia knows about me"** panel where the patient can
   confirm / correct / delete remembered facts (transparency + control).
3. **Contextual entry points:**

| Page | Button | Capability |
|---|---|---|
| `patient/lab-results` | "Explain my results" | Lab interpreter — **fixes the broken `/api/ai/lab-summary` button** + photo upload |
| `patient/medications` | "Ask about my meds" | Med coach + auto interaction warnings |
| `patient/vitals` | "What do these mean?" | Vitals interpreter, trend insight |
| `patient/dashboard` | proactive Amelia card | "I noticed your BP trending up — want to talk?" |

**No-doctor journey:** sign up → Amelia onboards ("tell me about your
health") → patient self-tracks vitals/meds → asks Amelia anything, gets
triage + plans → Amelia reminds, interprets labs, remembers history. Useful
**day one, zero doctors required** — and when the patient wants a doctor,
Amelia briefs that doctor instantly (the bridge to paid telemedicine).

**Safety UX in every reply:** urgency badge (🔴 emergency banner / 🟡 see a
doctor / 🟢 self-care); persistent "Amelia assists, not a substitute for a
doctor" footer; "confirm with a doctor" CTAs deep-linking to booking.

## 6. Doctor experience (the copilot)

Floating copilot on consultation + patient pages, plus inline actions:

| Where (real page) | Amelia does |
|---|---|
| `doctor/patients/[id]` | **"Catch me up"** → pre-visit summary of the whole chart |
| `doctor/consultation/[appointmentId]` | **"Draft SOAP note"** from visit transcript → editable → sign |
| same, side panel | **Differential support** → symptoms/labs in, ranked conditions + tests out (revives `diagnosis-support`) |
| prescription writing | **Safety net** → auto-flags interactions/dosing/allergies *before* sign |

**Human gate:** every Amelia-drafted note is doctor-reviewed before save.
She drafts; the doctor signs. She never writes to the chart unilaterally.

## 7. Safety — defense in depth

| Layer | What it does | Reuses |
|---|---|---|
| **0 · Deterministic pre-LLM** | Red-flag scanner runs **before** gpt-4o; emergency patterns → instant "seek emergency care," never trusting the model to catch it. Revives `detect_rule_emergency()` | new `safety.ts` |
| **1 · Grounding** | Tools read real data; she can't invent meds/labs | `getPatientContext` |
| **2 · Prompt** | Advisor prompt: hard scope limits + mandatory "confirm with a doctor" | `prompts.ts` |
| **3 · Output** | Urgency badge + disclaimer footer always rendered | UI |
| **4 · Human gate** | Notes/prescriptions are drafts a doctor signs; memory facts need patient confirmation | review UX |
| **5 · Audit & cost** | Every call logged, PHI-stripped; rate-limited; daily cost cap | existing `stripPhi()` / `logAudit()` + existing rate-limiter |

## 8. Phased build (each phase ships independently)

**Phase 1 — "Amelia talks, grounded & safe" (MVP)**
- `src/lib/amelia/` engine + `prompts.ts` + `safety.ts` + `getPatientContext`
- Patient chat: floating launcher + `/patient/amelia` (reuse chat components)
- Symptom triage + action plan (core Advisor)
- Red-flag emergency escalation
- Audit logging + rate limiting + daily cost cap
- Basic lab interpreter — **fixes the broken lab-summary button**
- Models: `AmeliaConversation`, `AmeliaMessage`

**Phase 2 — "Amelia acts & remembers"**
- Long-term memory (`AmeliaMemory` + save/get) + "What Amelia knows" panel
- Reminders (`Reminder` + `setReminder`, via `Notification`)
- Medication coach + interaction warnings
- Lab-photo OCR upload
- Proactive dashboard card

**Phase 3 — "Doctor copilot"**
- Pre-visit summary ("Catch me up")
- SOAP-note drafting
- Differential support (revive `diagnosis-support`)
- Prescription safety net

## 9. Stand-out extras (woven into phases / future)

- **Amelia speaks the patient's language** — app already ships next-intl in
  English, French, **Yoruba, Hausa, Igbo**. Amelia replying in the user's own
  language is a differentiator almost no health app has.
- **Locally-tuned triage** — revive reference Amelia's regional-disease
  awareness (malaria, typhoid, cholera, TB, Lassa) so triage fits real
  epidemiology, not a US-centric default.
- **Voice in/out** — talk to Amelia; accessibility + low-literacy win.
- **Proactive guardian** — watches vitals trends and reaches out first.

## 10. Dependencies & risks

- **Supabase project is DNS-down** as of 2026-06-08 (`iwdoeotxfbhtjyxlzcgo.
  supabase.co` returns NXDOMAIN). Amelia grounds on DB data, so the project
  must be restored before runtime testing. Does not block design/build.
- **OpenAI cost** — tool-calling multiplies token use. Daily cost cap +
  rate-limit are Phase-1 requirements, not afterthoughts.
- **Medical/legal** — Advisor tier names conditions and OTC remedies. The
  layered safety model + persistent disclaimers + emergency hard-stop are the
  mitigations. Quasi-clinician behaviors (prescription-class suggestions to
  patients) are explicitly out of scope.
- **Prompt injection** — lab-photo OCR and free-text patient input are
  untrusted; the engine must treat tool/document content as data, not
  instructions.

## 11. Out of scope (this spec)

- Solo-patient onboarding flow & positioning (separate, rides on Phase 1).
- Medical-records request + consent/approval workflow (separate subsystem).
- Background web-push for reminders (Phase 2+ enhancement; in-app
  `Notification` first).
- Replacing the human↔human chat system (untouched; Amelia is additive).
