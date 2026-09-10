# Known follow-ups

Documented gaps from Phases 1–5 that are NOT bugs — they're conscious
deferrals. Each has a rationale in the original task / phase plan.

## Amelia AI assistant

Phase 1 (grounded patient chat + triage + emergency safety + lab-summary fix)
and Phase 2 (long-term memory + reminders + medication coach + lab-photo OCR)
are complete. See `docs/superpowers/specs/2026-06-08-amelia-ai-assistant-
design.md` and the `…2026-06-09-amelia-phase-2-{memory,reminders,medication-
coach,lab-photo-ocr}-design.md` specs.

**Runtime infrastructure verified 2026-06-09** (Supabase restored from its pause):
- ✅ `npx prisma db push` applied — the 4 new Amelia tables exist and are
  queryable; existing data (3 users, 1 patient `test.patient@nalavita.test`)
  survived. Re-check anytime: `node --env-file=.env scripts/verify-amelia-db.mjs`.
- ✅ OpenAI key valid; gpt-4o (chat engine + lab-photo vision) and gpt-4o-mini
  (extraction) both reachable. Re-check: `node --env-file=.env scripts/verify-openai.mjs`.

**End-to-end smoke verified live 2026-06-09** (`scripts/smoke-amelia.mjs` — real
Supabase login cookies → live endpoints):
- ✅ `POST /api/amelia/chat` (routine symptom) → 200, urgency `routine`, a real
  grounded gpt-4o Advisor reply.
- ✅ `POST /api/amelia/chat` (chest pain) → 200, urgency `emergency`,
  deterministic hard-stop (no LLM call) — safety layer fires in prod.
- ✅ `GET /api/amelia/med-safety` + `GET /api/amelia/reminders` → 200.
- ✅ Writes persisted: 1 conversation, 4 messages, **1 auto-extracted memory**
  (gpt-4o-mini post-turn extraction ran end-to-end).
- The Chrome extension wasn't connected, so the literal browser UI render wasn't
  clicked through — but components are jsdom-tested and the endpoints return
  correct data, so the UI renders from verified responses.
- **Only path not exercised with real input:** lab-photo vision (`extractLabsFromImage`)
  — the gpt-4o vision model is confirmed reachable, but the photo→table flow
  needs a real lab-report image (do it via the UI when convenient).

### ⚠️ Pending live smoke: functional inference + SSE streaming (2026-08-06)

Three fixes shipped together — **functional inference** (`src/lib/amelia/functional.ts`),
**conversation persistence** (`src/lib/amelia/conversations.ts` + `/api/amelia/conversations`),
and **SSE streaming** (`AmeliaChat.tsx` + `useStickToBottom.ts`). `scripts/smoke-amelia-fixes.mjs`
exercises all three live.

Ran it on **2026-08-06 — it could not complete: the `OPENAI_API_KEY` in `.env` is
dead.** OpenAI returns `401 invalid_api_key`; confirmed independently of the app
(a bare `GET https://api.openai.com/v1/models` with that key also 401s), so this
is environmental, not a code defect. The key was valid on 2026-06-09 — revoked or
expired since.

What that run **did** verify (the no-LLM paths):
- ✅ Persistence end-to-end: real Supabase login → `GET /api/amelia/conversations?latest=1`
  → 200, conversation resumed, 6 conversations in the sidebar, derived titles present,
  `/conversations/[id]` → 200, unknown id → **404 (no cross-patient leak)**.
- ✅ Emergency hard-stop still fires with **no** LLM call — `urgency=emergency`,
  reply directs the patient to seek care. Safety layer intact.

**Still unproven end-to-end (do this first when a valid key is in `.env`):**
- Functional inference against real gpt-4o — do the lipstick / sticky-lock /
  fingerprint replies actually probe the body instead of answering cosmetically?
  Unit-covered by 12 tests in `src/__tests__/lib/amelia/functional.test.ts`
  (including those three cases and a "stays quiet on a plain symptom" control),
  but unit tests assert on the prompt, not on the model's reply.
- SSE streaming deltas arriving incrementally (`deltas > 1`, first-delta latency).
- The `restored transcript ≥ 4 messages` assertion, which failed only because the
  assistant turns never generated.

Re-run: `npm run dev`, then `node --env-file=.env scripts/smoke-amelia-fixes.mjs`.
Expect `ALL CHECKS PASSED`. Note the post-turn memory-extraction and
reminder-detection calls also 401 on a dead key (logged, non-fatal).

### Chat attachments moved to a private, authorized path (2026-08-06)

Attachments no longer go client-side to a public Supabase URL. `POST
/api/messages/attachments` uploads with the service role into the private
`medical-files` bucket, verifies the file's magic bytes against its declared MIME
type, records a `FileUpload` row categorised `chat-attachment:<receiverId>`, and
returns an opaque `/api/messages/attachments/<id>`. `POST /api/messages` accepts
*only* that shape (`parseChatAttachmentId`) and re-checks ownership, category and
single-use; `GET /…/attachments/[id]` streams the bytes with `no-store` +
`nosniff` after confirming the caller is a participant in the linked message.

Caught during commit prep: the server side was hardened but `ChatWindow` was
still uploading to Supabase and sending a public URL, which the new Zod schema
rejected — **every attachment send returned 400.** The client is now migrated,
covered by `src/__tests__/components/chat/ChatWindow-attachments.test.tsx` (the
upload-contract test was confirmed to fail if the old public-URL behaviour is
reintroduced).

Two leftovers worth knowing:
- Opaque URLs carry no file extension, so the renderer optimistically tries an
  `<Image>` and falls back to a download link via `onError` (`isRenderableImage`).
  Pre-migration messages with public `.png`-style URLs still render by extension.
- Messages sent before this change still hold public storage URLs and are served
  by the old public path. No back-fill was done.

**Lab-photo polish** (Phase 2 review, non-blocking): `LabPhotoUpload` redefines
`ExtractedLab`/`LabPhotoResult` locally rather than `import type`-ing them from
`labvision` (a deliberate client/server decoupling — revisit if it drifts).

**Medication-coach polish** (Phase 2 review, agreed non-blocking):
- `checkNewPrescriptionSafety` logs failures without patient/med context.
- `MedSafetyPanel` treats 401/404 the same as a generic error (no "you're
  logged out" distinction); uses array-index React keys.
- In-memory analysis cache has no TTL/size cap (fine for current deploy).

**Polish** (Phase 2 reviews, agreed non-blocking):
- `AmeliaMemoryPanel` / `AmeliaRemindersPanel` have no per-action loading/toast
  feedback or load-error state (UI just reloads / shows empty).
- Extraction + reminder-detection models are hardcoded to `gpt-4o-mini`.
- Reminder "Not now" dismissal is session-only (not persisted server-side).
- ~~**Amelia tables lack FK relations to `Patient`**~~ ✅ Done 2026-08-06.
  `AmeliaConversation`, `AmeliaMessage`, `AmeliaMemory` and `Reminder` now carry
  real `@relation`s with `onDelete: Cascade` (`AmeliaConversation.doctor` uses
  `SetNull`), plus a `prisma/migrations/20260717000000_baseline` migration.

**Remaining Amelia phases (designed at a high level, not yet built):**
- Phase 2 sub-feature still to do: proactive dashboard card.
- Phase 3 — doctor copilot: catch-me-up summary, SOAP-note drafting,
  differential support, prescription safety net; plus doctor-visible memory.
- Standout extras: multilingual replies (yo/ha/ig), locally-tuned triage,
  voice, proactive guardian.

## Code-level

1. **Wire `HealthDashboard.onUpdate` to a real API.** Currently the inline
   widget on `(patient)/dashboard` accepts a callback but isn't persisted.
   Needs a `DailyLog` Prisma model + `/api/patients/me/daily-log` endpoint.
   The current `Vital` model is per-reading; a daily-log is per-day-per-
   patient with water/steps/medsTaken summary. Either add it or repurpose
   `Vital`. Phase 4 Task 3 left a `TODO` comment in
   `PatientDashboardClient.tsx`.

2. **Replace ChatWindow internals with Phase 3 components.**
   `src/components/chat/ChatWindow.tsx` has its own bubble + textarea
   implementation. The Phase 3 `ChatMessage`, `ChatInput`, and
   `TypingIndicator` components are available but not composed. Refactor
   risk is "could break realtime + scroll" — needs a careful pass when
   there's appetite for it. Phase 4 Task 5 explicitly chose the lower-risk
   "just sweep blues" path.

3. **Add `ThemeContext` bridge for recharts.** Charts use static
   `THEMES.rose.primary` for stroke / fill. They won't re-tint when the
   user switches theme. Adding a small context that resolves the active
   CSS variable's RGB value at runtime would fix it. Phase 3 Task 2 left a
   `TODO Phase 4+` comment in `PatientIntakeChart.tsx`.

4. **Add `(patient)/pharmacy` backend.** Phase 5 Task 2 shipped a UI-only
   pharmacy page. A full implementation needs:
   - `PharmacyOrder` Prisma model with status enum (REQUESTED/READY/COLLECTED)
   - `/api/pharmacy/orders` POST/PATCH/GET
   - Notification fired when the order status changes to READY

5. **Cosmetic file extraction.** `src/lib/openai.ts`, `src/lib/stripe.ts`
   (note: would be `paystack.ts`), `src/lib/validations.ts` are not
   standalone — logic is inlined in routes. Functional equivalents exist;
   purely a discoverability / convention cleanup.

6. **`src/hooks/useAuth.ts` missing.** Auth currently uses Supabase client
   directly in components. A `useAuth()` hook would centralise. Cosmetic.

7. **Step 25 runtime: RLS policies applied in Supabase dashboard.**
   ✅ Done 2026-05-22. 60 policies applied across 16 tables. See
   `docs/SUPABASE_SETUP.md` for the apply command.

8. **Spec Stripe items vs. Paystack reality.** See
   [`docs/decisions/2026-05-22-paystack-over-stripe.md`](decisions/2026-05-22-paystack-over-stripe.md). Spec says Stripe; we use Paystack
   (better fit for NGN market). Future maintainers should reference the ADR.

## Amelia AI assistant

Design spec: `docs/superpowers/specs/2026-06-08-amelia-ai-assistant-design.md`.
Phase 1 plan: `docs/superpowers/plans/2026-06-08-amelia-phase-1.md`.

**Phase 1 — ✅ code complete** (branch `feat/amelia-phase-1`, tag
`amelia-phase-1-complete`). Grounded patient chat engine (`src/lib/amelia/`),
`/api/amelia/chat`, the lab-summary route (which fixed a broken UI button),
the floating launcher + `/patient/amelia` page. 97 tests green, prod build
passes. **Two runtime steps remain before it works live:**
   - `npx prisma db push` to create `amelia_conversations` + `amelia_messages`
     (needs the Supabase project restored — it was DNS-down on 2026-06-08).
   - A valid `OPENAI_API_KEY` in `.env` for real model calls.
   Then smoke `/patient/amelia` (normal + emergency phrasing) and the
   lab-results "Explain my results" button.

**Phase 2 (next):** long-term memory + "What Amelia knows" panel, reminders,
medication coach + interaction warnings, lab-photo OCR, proactive dashboard
card, dynamic tool-calling, streaming responses.

**Phase 3:** doctor copilot — pre-visit summary, SOAP-note drafting,
differential support, prescription safety net.

## Operational

9. **18 npm audit vulnerabilities** (1 low, 11 moderate, 6 high) noted
   during `npm install`. Run `npm audit fix --force` and re-test when
   there's time.

10. **Windows file-locking on `.next/trace`.** Hit twice during Phase 1
    builds. Workaround documented:
    `cmd //c "taskkill /F /IM node.exe" && rm -rf .next` before re-building.
    Likely a Next.js + Windows interaction; not Nala-Vita-specific.

12. **Benign `next-intl` webpack cache warning.** Every `npm run dev`
    prints:
    ```
    <w> [webpack.cache.PackFileCacheStrategy/webpack.FileSystemInfo]
        Parsing of …/next-intl/dist/esm/production/extractor/format/index.js
        for build dependencies failed at 'import(t)'.
    <w> Build dependencies behind this expression are ignored and might
        cause incorrect cache invalidation.
    ```
    This is an upstream issue in `next-intl`'s build output — it uses a
    dynamic `import(t)` that webpack's cache strategy can't statically
    analyse. **No runtime impact.** The warning is purely about webpack's
    cache being unable to track that one internal file for invalidation.
    Worst-case symptom (rare): after upgrading `next-intl`, the dev cache
    might serve a stale module. Workaround if that ever happens:
    `rm -rf .next && npm run dev`. Not worth suppressing.

## Documentation

12. **Per-route ownership doc.** No `docs/ARCHITECTURE.md` exists. Useful
    if more than one developer joins. Should cover: route groups, the
    server-component layout pattern, the SidebarShell composition, the
    Phase 1 theming system, and the realtime subscription topology.
