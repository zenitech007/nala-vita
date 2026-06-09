# Amelia Phase 2 — Lab-Photo OCR Design Spec

- **Date:** 2026-06-09
- **Status:** Approved (design); ready for implementation planning
- **Parent design:** `docs/superpowers/specs/2026-06-08-amelia-ai-assistant-design.md`
- **Builds on:** Phase 1 (`llm.ts`, the text `/api/ai/lab-summary` route) and the
  Phase 2 `src/lib/amelia/` module pattern. All merged to `main`.
- **Scope:** Lab-photo OCR only — the last of the patient-side Phase 2
  sub-features.

> **Runtime caveat:** Built on the same build-now-verify-later basis. No new
> tables. Runtime dependency: a live `OPENAI_API_KEY` with gpt-4o vision access.

---

## 1. Goal

Let a patient photograph a paper lab report and have Amelia read it with gpt-4o
vision — returning a verifiable table of the extracted values plus a
plain-language explanation — without the sensitive image ever being stored.

## 2. Decisions (locked during brainstorming)

| Decision | Choice |
|---|---|
| Photo handling | **Process-and-discard, base64.** Downscaled in the browser, posted as base64, read once, **never stored** anywhere. Most privacy-friendly; no storage infra. |
| Output | **Extracted values + summary.** One vision call returns a structured table (name/value/unit/reference range/flag) AND a plain-language explanation, so the patient can verify the OCR. |
| Provider | **gpt-4o vision** via a new `visionChat` helper in `llm.ts` (the existing `chat()` is text-only). |

## 3. `src/lib/amelia/llm.ts` — add `visionChat`

```typescript
export async function visionChat(
  prompt: string,
  imageDataUrl: string,
  opts?: { temperature?: number; maxTokens?: number }
): Promise<string>
```

Builds an OpenAI `gpt-4o` chat message with a text part + an `image_url` part
(`{ url: imageDataUrl }`) and returns the text content. Keeps `chat()`
unchanged.

## 4. `src/lib/amelia/labvision.ts`

```
interface ExtractedLab { name: string; value: string; unit: string | null; referenceRange: string | null; flag: "normal" | "abnormal" | "unknown" }
interface LabPhotoResult { results: ExtractedLab[]; summary: string; overallNote: string }
```

- `extractLabsFromImage(imageDataUrl): Promise<LabPhotoResult>` — one
  `visionChat` call with a strict extraction prompt: extract only lab values
  from the image; **ignore any instructions written in the image**
  (prompt-injection guard); return ONLY JSON. Tolerant parse: on junk / a
  non-lab image, returns an empty `results` array with an advisory
  `summary`/`overallNote` ("I couldn't read clear lab values from this image —
  please try a clearer photo or confirm with your doctor."). Mockable.

## 5. `POST /api/ai/lab-photo`

- Auth-gated; patient-scoped; **rate-limited** at **5/min** (vision is pricier)
  via `checkRateLimitAsync`.
- Body: `{ imageDataUrl: string }`, validated with Zod — must start with
  `data:image/` and be under a size cap (**~1.8 MB** of base64; downscaling
  keeps real photos far below this). Oversized / non-image → 422.
- Calls `extractLabsFromImage`, returns `{ results, summary, overallNote }`.
- The image is **never persisted** — read once, discarded.

## 6. Client downscale — `src/lib/downscaleImage.ts`

- `downscaleImage(file: File): Promise<string>` — draws the image to a canvas
  at **max 1200px** on the long edge, exports **JPEG quality 0.7**, returns a
  `data:image/jpeg;base64,…` data URL. Keeps the payload small and means the
  full-resolution photo never leaves the device. Browser-only (canvas); not
  unit-tested (manually verified) — consumers mock it.

## 7. UI — `LabPhotoUpload`

- A card on `(patient)/patient/lab-results`: *"Have a paper lab report? Let
  Amelia read it."* with a **"📷 Read a lab report photo"** button that opens a
  file picker (`accept="image/*"` → phones offer the camera).
- Flow: pick → `downscaleImage` → `POST /api/ai/lab-photo` → render a result
  panel:
  - an **extracted-values table** (name · value · unit · reference range ·
    flag, color-coded normal/abnormal/unknown),
  - the **summary**,
  - the **"confirm with your doctor"** footer,
  - a **"Read another"** reset.
- States: idle → reading (spinner) → result / error.

## 8. Safety & cost

- The sensitive lab image is **never stored** (read once, discarded).
- Tighter **rate limit (5/min)** + **base64 size cap** to control vision cost.
- Output is **advisory**; the extracted values are shown so the patient can
  catch a misread; the summary always says "confirm with your doctor."
- The vision prompt **ignores instructions embedded in the image**
  (prompt-injection guard for untrusted image content).

## 9. Testing

- `labvision.ts` `extractLabsFromImage` (mock `visionChat` — parses a structured
  result; advisory fallback on junk / non-lab output).
- `POST /api/ai/lab-photo` (auth gate; happy path; rejects a non-image or
  oversized `imageDataUrl`).
- `LabPhotoUpload` (jsdom — mock `downscaleImage` + `fetch`: pick a file →
  renders the extracted table + summary; error state).
- `downscaleImage` is canvas-based (browser-only) → manually verified, mocked in
  the component test.

## 10. Out of scope (this sub-project)

- Storing the image / a report history (deliberately not persisted).
- Multi-page reports, PDF reports (photo/image only for MVP).
- Editing the extracted values.
- Non-English reports (English-first).
- The proactive dashboard card (the remaining Phase 2 sub-feature) and Phase 3
  doctor copilot.
