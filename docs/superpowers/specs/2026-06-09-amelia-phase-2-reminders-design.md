# Amelia Phase 2 — Reminders Design Spec

- **Date:** 2026-06-09
- **Status:** Approved (design); ready for implementation planning
- **Parent design:** `docs/superpowers/specs/2026-06-08-amelia-ai-assistant-design.md`
- **Builds on:** Phase 1 (chat engine, chat route, `/patient/amelia` page) and
  Phase 2 memory (the post-turn extraction pattern, the two-tab page, the
  patient-scoped CRUD pattern). Both merged to `main`.
- **Scope of this spec:** Reminders only — the second of the Phase 2
  sub-features. Medication coach and lab-photo OCR follow as their own specs.

> **Runtime caveat:** Like the rest of Amelia, this is built on the
> build-now-verify-later basis (Supabase was DNS-down during the build). The
> `reminders` table push + live smoke happen once Supabase is restored.

---

## 1. Goal

Let a patient ask Amelia, in plain language, to remind them about something
("remind me to take my BP meds every morning at 8"), have Amelia **propose** a
structured reminder the patient confirms with one inline tap, and have that
reminder **fire on time into the notification bell** — without any background
infrastructure.

## 2. Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Firing mechanism | **In-app, lazy** — a `fireDueReminders(patientId)` function called from the existing `GET /api/notifications` route. Due reminders materialize into Notifications on the next poll. No cron, no push, host-agnostic; clean upgrade path to cron/push later. |
| Creation | **Amelia proposes, patient confirms** — a post-turn gpt-4o-mini pass detects a reminder request and Amelia shows an **inline confirmation card** in chat; one tap creates it. Conversational magic + medical reliability (the parsed time is shown before creation). |
| Frequencies (MVP) | **ONCE and DAILY.** WEEKLY deferred (needs day-of-week). Covers daily meds + one-time appointment nudges. |
| Management UI | A **third tab** on the Amelia page (Chat \| What Amelia knows \| **Reminders**) for viewing/cancelling only. Creation is always conversational. |

## 3. Data model

New Prisma model (additive):

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

`prisma generate` is offline-safe; `db push` deferred. Tests mock Prisma.

## 4. `src/lib/amelia/reminders.ts`

Each function has one responsibility and is independently testable:

- `detectReminder(userText, assistantText): Promise<ReminderCandidate | null>`
  — one **gpt-4o-mini** call. Returns `null` if the patient wasn't asking for a
  reminder; otherwise a structured candidate:
  `{ kind, label, frequency: "DAILY", hour, minute }` **or**
  `{ kind, label, frequency: "ONCE", isoDateTime }`. Mockable; tolerant JSON
  parsing (returns `null` on parse failure).
- `computeNextFireAt(candidate, now): Date` — **pure, deterministic** date math
  (code owns scheduling; the LLM is not trusted with date arithmetic):
  - DAILY → today at hour:minute if still in the future, else tomorrow.
  - ONCE → the provided `isoDateTime`.
- `describeSchedule(reminder): string` — pure; "every day at 8:00 AM" /
  "on Jun 12 at 2:00 PM" for the confirmation card + the tab.
- `createReminder(patientId, { kind, label, frequency, nextFireAt })`
- `listReminders(patientId)` — active reminders, soonest first.
- `cancelReminder(id, patientId)` — patient-scoped (`where: { id, patientId }`).
- `fireDueReminders(patientId): Promise<number>` — find `active` reminders with
  `nextFireAt <= now`; for each, call the existing `createNotification()`; then
  **advance** `nextFireAt` by one day (DAILY) or **deactivate** (ONCE). Returns
  the count fired. Safe to call on every poll (cheap indexed query).

## 5. Integration

- **Detection (write path):** the chat route (`POST /api/amelia/chat`), after
  persisting Amelia's reply and running memory extraction, also calls
  `detectReminder(message, reply.content)`. If non-null, it computes
  `nextFireAt` and includes a `reminderSuggestion` object in the JSON response
  containing the complete create payload — `{ kind, label, frequency,
  nextFireAt }` — plus a human-readable `schedule` string (from
  `describeSchedule`) for the card. The card POSTs that payload verbatim. It
  does **not** create the reminder yet — the patient confirms first.
- **Firing (read path):** `fireDueReminders(patientId)` is called at the top of
  the existing `GET /api/notifications` route, before it returns the
  notifications list. The notification bell's existing poll thus surfaces due
  reminders with no new client wiring.

## 6. API

All auth-gated; all verify the reminder's `patientId` matches the requester.

- `POST /api/amelia/reminders` → body `{ kind, label, frequency, nextFireAt }`
  (validated with Zod); creates the reminder from the confirmation card.
- `GET /api/amelia/reminders` → the patient's active reminders (for the tab).
- `DELETE /api/amelia/reminders/[id]` → cancel (patient-scoped).

## 7. UI

- **In-chat confirmation card** (`AmeliaChat`): when a chat response carries a
  `reminderSuggestion`, render an inline card beneath Amelia's message:
  "🔔 Remind you to {label}, {describeSchedule}?" with **[ Set reminder ]** and
  **[ Not now ]**. Tapping Set POSTs to `/api/amelia/reminders`; the card flips
  to "✓ Reminder set." All in-chat, one tap, no form.
- **Reminders tab** (`AmeliaRemindersPanel`): the Amelia page gains a third tab
  (Chat \| What Amelia knows \| Reminders). Lists active reminders with their
  schedule + a **Cancel** button. Empty state: *"No reminders yet — just ask
  Amelia to remind you about anything."* View/cancel only; never creates.

## 8. Safety & cost

- One extra **gpt-4o-mini** detection call per turn (cheap); rides the chat
  route's existing rate limit.
- The patient **always sees the parsed schedule** before a reminder is created
  — no silent wrong-time medical reminders.
- Reminders are patient-owned rows, protected by the existing RLS policies.
- `fireDueReminders` is idempotent-ish per fire: it advances/deactivates
  immediately after creating the notification, so a reminder can't double-fire
  within the same due window.

## 9. Testing

- `reminders.ts`: `detectReminder` (mock llm — request vs. no-request vs.
  bad JSON); `computeNextFireAt` (pure — DAILY future/past, ONCE); `describeSchedule`
  (pure); `createReminder`/`listReminders`/`cancelReminder` (mock Prisma,
  patient-scoping); `fireDueReminders` (mock Prisma + `createNotification` —
  DAILY advances, ONCE deactivates, returns count).
- Chat route: a `reminderSuggestion` is returned when `detectReminder` is
  non-null, and omitted when null (mock memory + reminders).
- Notifications route: `fireDueReminders` is invoked before listing.
- 3 reminder API routes: auth gate + happy path (mocked).
- `AmeliaChat`: renders the card from a `reminderSuggestion` and POSTs on Set.
- `AmeliaRemindersPanel`: lists reminders, Cancel fires DELETE.

## 10. Out of scope (this sub-project)

- WEEKLY / custom-interval frequencies (day-of-week scheduling).
- Server cron or web-push delivery (the lazy in-app firing is the MVP; both are
  clean future upgrades that reuse `fireDueReminders` unchanged).
- Editing an existing reminder (cancel + re-ask Amelia for MVP).
- Snooze.
- Medication coach and lab-photo OCR (separate Phase 2 sub-projects).
