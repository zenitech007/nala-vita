# MediConnect Pivot — Roadmap

> **⚠️ SUPERSEDED (2026-05-22):** This roadmap planned a from-scratch pivot of the old Amelia frontend at `nalavita-frontend/`. That direction was abandoned in favour of relocating a pre-existing MediConnect implementation from `C:\Users\IKA\Med connect\` into the Nala Vita root. The relocated codebase already covers most of Phases 1–6 and 8–9. **Outstanding work** from this document that still applies: Phase 7 (Stripe payments — `package.json` has no `stripe` dep), and any Step 26 final integration checklist items not yet verified. Keep this file for the gap analysis and pending-work signal; do not execute Phase 1 below.

> **For agentic workers:** This roadmap is the index. Per-phase implementation plans are separate files in this same directory, named `2026-05-21-mediconnect-pivot-phase-N-<slug>.md`. Use **superpowers:subagent-driven-development** to execute each phase plan, with review between tasks.

**Goal:** Pivot the Nala Vita codebase (`nalavita-frontend` Next.js app + `nalavita-backend` Python sidecar) to strictly match the MediConnect spec in `C:\Users\IKA\Downloads\medapp-claude-code-prompt.md`.

**Architecture:** Single Next.js 16 App Router project under `src/` (per spec). Server-only API routes scoped by Supabase session + Prisma client. All AI calls go through OpenAI gpt-4o. WebRTC signaling rides on Supabase Realtime. Payments via Stripe. Admin section added. Python backend (`nalavita-backend`) is **out of scope** for the pivot — it stays untouched until a later decision (see "Open questions" below).

**Tech Stack (pinned by spec):** Next.js (App Router), TypeScript, Tailwind CSS, Prisma ORM, Supabase (PostgreSQL + Auth + Storage + Realtime), Stripe, OpenAI (`openai` SDK, gpt-4o), `next-intl` for i18n, `react-hook-form` + `zod` for forms, `@tanstack/react-query` for client data, `recharts` for analytics charts.

---

## Source of truth

| | Path |
|---|---|
| Spec | `C:\Users\IKA\Downloads\medapp-claude-code-prompt.md` |
| Gap audit | this document, "Gap summary" below |
| Codebase graph | `C:\Users\IKA\Nala Vita\graphify-out\GRAPH_REPORT.md` |
| Plan files | `C:\Users\IKA\Nala Vita\docs\superpowers\plans\` |

---

## What "strict pivot" means — explicit decisions

The user chose "Pivot to MediConnect spec strictly" during planning. Concretely:

| Decision | Action |
|---|---|
| Amelia AI assistant (chat + medical memory + memory categories) | **Removed.** All `MedicalMemory`, `Chat`, `Message` (in current sense), `classifyMemory`, and `memory.ts` code is deleted in Phase 1. |
| Gemini Vision lab-PDF parsing (`api/analyze-lab/route.ts`, `lib/ai.ts` Gemini calls) | **Removed.** Spec defines `LabOrder`/`LabResult` as manually entered by a lab/doctor with optional `fileUrl` upload. No automated lab-PDF parsing. **Capability loss** — see "Capability tradeoffs" below. |
| `@google/generative-ai` dep | **Uninstalled** in Phase 1. |
| Python `nalavita-backend` | **Not touched** — spec is Next.js-only. Backend stays running but becomes orphaned. User decides later whether to retire it. |
| Flat routes (`/dashboard`, `/patient-portal`) | **Renamed** to spec route groups `(patient)`, `(doctor)`, `(admin)`, `(auth)`. |
| No `src/` dir | **Created** — everything moves under `src/` per spec. |
| Prisma `db push` (no migrations dir) | **Switched** to `prisma migrate dev` — proper migrations dir initialised in Phase 1. |
| `@supabase/ssr` (already installed) vs spec's `@supabase/auth-helpers-nextjs` | **Keep `@supabase/ssr`** — `auth-helpers-nextjs` is deprecated upstream. Spec code samples adapted accordingly (called out in each phase plan). |
| Next 16 / React 19 vs spec's Next 14 | **Keep Next 16 / React 19.** Spec is a target shape, not a version pin. App Router code is compatible. |
| `socket.io` (spec mentions) | **Skip.** Spec uses it nowhere concrete; Supabase Realtime covers all the spec's realtime needs (messaging, video signaling, notifications). Removing socket.io from the install list — call this out for user. |
| `next-auth` / `NEXTAUTH_SECRET` env var (spec mentions) | **Skip.** Spec doesn't actually wire NextAuth — auth is fully Supabase. Drop the env var. Call out for user. |

### Capability tradeoffs (user, confirm before Phase 1 executes)

1. **Lab PDF auto-parsing goes away.** The spec has no equivalent. If you want it back later, it lives outside the spec as a Phase 10+ addition. Acceptable?
2. **Amelia memory disappears.** Patient observations stored in `MedicalMemory` will be lost when the table is dropped in Phase 1. If you have production users, export first. Acceptable?
3. **Existing chat history (`Chat`, `Message`) disappears.** The new `Message` model in the spec is patient↔doctor messaging — different semantics. The current AI chat history is dropped. Acceptable?
4. **Python `nalavita-backend` becomes orphaned.** Spec doesn't define a Python sidecar. We keep it running but stop investing. Acceptable, or do you want a phase to retire it?

These four are blocking — answer before executing Phase 1.

---

## Gap summary (from audit)

See conversation transcript for the full table. Headline gaps:

1. No Stripe / payments layer (Phase 7)
2. No Telemedicine / WebRTC (Phase 5)
3. Missing 8 Prisma models: `Admin`, `Prescription`, `Vital`, `LabOrder`, `MedicalNote`, `Referral`, `Payment`, `Notification`, `BedResource` (Phase 1)
4. No `(admin)` route group (Phase 8)
5. No doctor-side workflow pages: `appointments`, `consultation/[id]`, `prescriptions`, `lab-orders`, `monitoring`, `referrals`, `billing` (Phases 3, 5)
6. No AI symptom-check / diagnosis-support / risk-score endpoints (Phase 4)
7. No patient↔doctor realtime messaging (Phase 6)
8. No i18n / next-intl (Phase 9)
9. No `/api/upload` route (Phase 8)
10. Schema field drift on `Doctor`/`Patient`/`Appointment` (Phase 1)

---

## Phase plan

Each phase produces working, testable software on its own. Phases are executed in order; each unlocks the next. A phase plan file is written **just before** that phase starts (avoids stale detail).

| # | Phase | Plan file | Deliverable | Depends on | Est. tasks |
|---|---|---|---|---|---|
| 1 | **Foundation & teardown** | `2026-05-21-mediconnect-pivot-phase-1-foundation.md` (written now) | Spec-shaped repo: deps installed, full schema migrated, route groups renamed, RBAC middleware, lib helpers, Amelia removed. App boots; `/login` renders; unauthenticated users hit `/login`. | — | ~16 |
| 2 | **Auth (Step 5, 24)** | `…phase-2-auth.md` | `(auth)/login` + `(auth)/register` pages, `/api/auth/register`, RBAC middleware enforces patient/doctor/admin redirects end-to-end. | Phase 1 | ~8 |
| 3 | **Patient core: dashboard, appointments, vitals (Steps 6, 8, 10, 13)** | `…phase-3-patient-core.md` | Patient can log in, see dashboard, book an appointment, log a vital reading. Doctor sees the appointment + vital alerts in their monitoring page. | Phase 2 | ~14 |
| 4 | **AI clinical features (Steps 7, 20)** | `…phase-4-ai.md` | `/api/ai/symptom-check`, `/api/ai/diagnosis-support`, `/api/ai/risk-score` endpoints + patient `symptom-checker` UI + daily background risk-scoring job. | Phase 3 | ~10 |
| 5 | **Doctor workflows: dashboard, telemedicine, prescriptions, labs (Steps 9, 11, 12, 15)** | `…phase-5-doctor-clinical.md` | Doctor dashboard with queue + analytics; WebRTC video consult with voice-to-text notes; prescription write & view; lab orders & results. | Phase 4 | ~22 |
| 6 | **Messaging & notifications (Steps 14, 17)** | `…phase-6-messaging.md` | Patient↔doctor realtime chat; `NotificationBell`; `createNotification()` server util wired into every event-emitting route. | Phase 5 | ~10 |
| 7 | **Payments (Step 16)** | `…phase-7-payments.md` | Stripe payment intent flow end-to-end; webhook updates appointment + notifies; patient payments page; doctor billing page. | Phase 5 | ~10 |
| 8 | **Admin, analytics, uploads, referrals (Steps 18, 19, 21, 22)** | `…phase-8-admin-extras.md` | Admin dashboard / staff / beds / reports; doctor analytics page (recharts); `/api/upload` to Supabase Storage; referral system. | Phase 7 | ~14 |
| 9 | **Compliance & polish (Steps 23, 25)** | `…phase-9-compliance.md` | i18n (5 locales), accessibility toggles, rate limiting on AI endpoints, AuditLog wired into every mutating route, RLS policy docs for Supabase dashboard. | Phase 8 | ~10 |

**Total estimated tasks across all phases: ~114.** Rough calendar estimate: 4–6 weeks of focused solo work.

---

## How to use this roadmap

1. **Now:** Confirm the four blocking decisions in "Capability tradeoffs."
2. **Phase 1 plan is ready** at `2026-05-21-mediconnect-pivot-phase-1-foundation.md`. Execute it via `superpowers:subagent-driven-development` (one subagent per task, review between).
3. **Before each subsequent phase:** ask the planner to write the next phase plan. Don't pre-write — the codebase will have changed and the plan would drift.
4. **Verification checkpoint after each phase:** run `graphify update "C:\Users\IKA\Nala Vita"` to refresh the graph, then `graphify query "<phase deliverable question>"` to confirm the new code is wired correctly.
5. **At the very end:** run the Step 26 final integration checklist against the running app.

---

## Open questions for the user (must answer before Phase 1)

1. Confirm capability tradeoffs 1–4 above (lab PDF parser, Amelia memory, chat history, Python backend orphaning).
2. Is the production database empty / disposable? Strict pivot means we drop and recreate every table. If there are live users, we need an export-first task in Phase 1.
3. Stripe currency: spec uses `NGN`. Confirm — or change to USD / GBP / EUR.
4. i18n locales: spec lists `en, fr, yo, ha, ig`. Confirm or amend (Phase 9).
5. Telemedicine: spec uses WebRTC + Supabase Realtime signaling (no SFU, no third-party service). Confirm — for >2-party calls or recording you'd need Daily / LiveKit / Agora.
