# Amelia Phase 2 — Medication Coach Design Spec

- **Date:** 2026-06-09
- **Status:** Approved (design); ready for implementation planning
- **Parent design:** `docs/superpowers/specs/2026-06-08-amelia-ai-assistant-design.md`
- **Builds on:** Phase 1 (engine, `llm.ts`), Phase 2 memory + reminders (the
  `src/lib/amelia/` module pattern, patient-scoped routes, `createNotification`
  integration). All merged to `main`.
- **Scope:** The medication coach only — the third Phase 2 sub-feature.
  Lab-photo OCR follows as its own spec.

> **Runtime caveat:** Built on the same build-now-verify-later basis (Supabase
> DNS-down during the build). No new tables here (in-memory cache), so the only
> runtime dependency is a live `OPENAI_API_KEY` + the existing data.

---

## 1. Goal

Proactively warn a patient about potential drug interactions, dosing concerns,
and allergy conflicts across their active medications — grounded in their real
prescription + allergy data, always framed as "potential, confirm with your
pharmacist/doctor."

## 2. Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Interaction knowledge source | **LLM-based (gpt-4o)**, framed as "potential," **plus a deterministic allergy cross-check** safety net. No external drug DB, no keys. |
| Surfacing | **Both:** (a) an auto-running, cached "Medication safety" panel on the patient's medications page; (b) a proactive **notification when a doctor prescribes a new medication**. |
| Caching | **In-memory**, keyed by `patientId + medListHash`. No new DB table. Re-runs only when the med list changes. |
| Doctor-facing version | Deferred to Phase 3. This is patient-advisory only. |

## 3. `src/lib/amelia/medsafety.ts`

```
interface MedSafetyResult {
  interactions:     { drugs: string[]; severity: "high" | "moderate" | "low"; note: string }[];
  dosingNotes:      { medication: string; note: string }[];
  allergyConflicts: { medication: string; allergy: string; note: string }[];
  overallNote:      string;
}
```

- `medListHash(meds): string` — pure; stable hash of the sorted
  medication names + dosages (order-independent).
- `exactAllergyMatches(meds, allergies): { medication, allergy, note }[]` —
  pure, deterministic safety net: flags any med whose name contains a listed
  allergy term (case-insensitive). Guarantees obvious matches are never missed.
- `analyzeMedications(meds, allergies): Promise<MedSafetyResult>` — one
  **gpt-4o** call (structured JSON). The LLM catches drug-class allergy
  conflicts (e.g. amoxicillin ↔ a penicillin allergy) and interactions/dosing.
  Results are merged with `exactAllergyMatches` (deduped). Mockable.
- `getCachedOrAnalyze(patientId, meds, allergies): Promise<MedSafetyResult>` —
  in-memory cache keyed by `patientId + medListHash`; returns cached result if
  the med list is unchanged, else analyzes + caches.
- `checkNewPrescriptionSafety(patientId, newMedName): Promise<void>` — loads the
  patient's active meds + allergies, analyzes, filters for **high/moderate**
  concerns that **involve `newMedName`** (its name appears in an interaction's
  `drugs` or an `allergyConflict.medication`); if any, looks up the patient's
  `userId` and calls `createNotification(userId, "Medication safety", …,
  "MED_SAFETY", { link: "/patient/medications" })`. Best-effort.

## 4. API

- `GET /api/amelia/med-safety` — auth-gated, patient-scoped, rate-limited
  (`checkRateLimitAsync`). Loads the patient's active prescriptions + allergies,
  runs `getCachedOrAnalyze`, returns `{ result }`.

## 5. Integration — proactive notification

- `POST /api/prescriptions` (the doctor's prescribe route): **after** the
  prescription is created, call `checkNewPrescriptionSafety(patientId,
  medication)` inside a try/catch (never block or break prescribing). Targeting
  only concerns involving the *new* drug avoids re-notifying about pre-existing
  combinations.

## 6. UI

- `MedSafetyPanel` (client) on `(patient)/patient/medications`: **auto-fetches**
  `GET /api/amelia/med-safety` on mount and renders a "Medication safety"
  section:
  - interactions grouped by severity (🔴 high / 🟡 moderate / ⚪ low),
  - dosing notes,
  - allergy conflicts,
  - the "confirm with your pharmacist or doctor" footer.
  - Loading spinner, empty state ("No concerns found across your current
    medications."), and an error state.
- Placed near the top of the medications page so it's seen on every visit.

## 7. Safety & cost

- Every warning is **advisory** — "potential, confirm with a professional" —
  never definitive, never written to the chart.
- gpt-4o analysis is **cached by med-list hash**: repeated page visits don't
  re-run; the prescription hook runs one analysis per new-med event (rare).
- The `med-safety` endpoint is rate-limited.
- The deterministic allergy net guarantees obvious name matches are caught even
  if the LLM misses them.
- Grounded in the patient's real prescriptions + allergies; the model is
  instructed never to invent medications not in the list.

## 8. Testing

- `medsafety.ts`: `medListHash` (pure, order-independent), `exactAllergyMatches`
  (pure), `analyzeMedications` (mock llm — parses structured result, merges the
  deterministic net), `getCachedOrAnalyze` (cache hit vs miss), and
  `checkNewPrescriptionSafety` (mock llm + prisma + createNotification —
  notifies on a high-severity concern involving the new med, silent otherwise).
- `GET /api/amelia/med-safety`: auth gate + happy path (mocked).
- `POST /api/prescriptions` hook: calls `checkNewPrescriptionSafety` best-effort
  after create (mocked).
- `MedSafetyPanel` (jsdom): renders severities, and the loading/empty/error
  states.

## 9. Out of scope (this sub-project)

- External drug-interaction databases / RxNorm normalization.
- Persisted analysis cache (in-memory only for MVP).
- Doctor-facing medication safety (Phase 3 — the prescription safety net).
- Editing/acknowledging individual warnings.
- Lab-photo OCR (separate Phase 2 sub-project).
