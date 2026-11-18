# Nala Vita audit report

Date: November 4, 2026 (America/Phoenix). Checkout: `3e85d5a5ae75a19beef63d3f60fd456000cbff38`. Scope: the active application in `C:/Users/IKA/Nala Vita`, frontend, API, schema, migrations, configuration, tests, and integration boundaries.

This is an audit, not an implementation. No fixes were applied or committed. Generated build/test artifacts were allowed by the user during the audit. Next.js startup appended a block to `AGENTS.md`; that automatic change was restored from its original Git contents after stopping the development server. The four pre-existing modified source files and untracked `Searches/` directory were preserved.

## 1. Executive summary

| Dimension | Health / 10 | Assessment |
| --- | ---: | --- |
| Backend | 4 | Useful domain structure and passing tests, with serious authorization and integrity gaps. |
| Frontend | 5 | Considerable implementation, but several workflows are simulated, disconnected, or lose state. |
| UI/UX | 4 | Shared primitives and responsive classes exist; accessibility, truthfulness, and error recovery need work. Visual score is provisional because browser capture failed. |
| Security | 2 | Record claiming, patient access, server session trust, and database policy design need release-blocking fixes. |
| Performance | 5 | Parallel queries, bounded dashboard queries, and local fonts are positives; migration/index drift, unbounded lists, and per-conversation query fan-out remain. No reliable production performance measurements were obtained. |

Do not release this checkout for real patient use before resolving the critical findings. Isolated probes reproduced a phone-only medical-record claim, fabricated normal lab findings during provider outage, loss of the newest AI message after 20 stored messages, and a doctor creating their own access relationship to an existing patient. Other probes reproduced unauthorized clinical actions, cross-patient data processing, overlapping bookings, privacy-filter bypass, and payment replay problems. All 58 existing test suites passed across separate runs, totaling 243 tests; that does not establish security coverage, since many of these failure paths are absent from those tests. Build, visual, hosted-service, and dependency results are qualified below rather than treated as evidence of production readiness.

### Architecture and discovery

The active product is one Next.js App Router application, not separate frontend/backend services. The installed framework is **Next.js 16.3.4**, despite `CLAUDE.md` describing Next 14. React 18.3.1 and TypeScript 5.9.3 supply the frontend; Tailwind 3, Framer Motion, Recharts, next-intl, React Hook Form, and TanStack Query support the UI. Route handlers under `src/app/api` call Prisma 7.10.0 through `@prisma/adapter-pg` and `pg` to a Supabase PostgreSQL database. Supabase supplies cookie-based Auth, Storage, and Realtime; Gemini/OpenAI supply AI services, Paystack handles hosted payment initialization/webhooks, and Upstash is an optional distributed limiter. Browser requests primarily use same-origin `/api` endpoints, while Auth and Realtime also communicate directly with Supabase. The repository uses npm and `package-lock.json`; Jest has separate Node and jsdom projects.

| Location | Purpose / entry point |
| --- | --- |
| `src/app/layout.tsx`, `src/app/page.tsx` | Root providers, metadata, fonts, public entry page. |
| `src/app/(auth)` | Login and registration. No forgot/reset-password route was found. |
| `src/app/(patient)`, `(doctor)`, `(admin)` | Role-specific layouts and screens. |
| `src/app/api` | 48 route-handler files for auth, appointments, clinical records, messages, AI, billing, settings, administration. |
| `src/middleware.ts` | Protected-page routing and session/metadata-based role checks. |
| `src/lib`, `src/hooks`, `src/components` | Auth/database/service helpers, client state, shared UI. Active source inventory: 183 non-test/non-mock TypeScript files. |
| `prisma/schema.prisma`, `prisma.config.ts` | Database model and Prisma CLI connection configuration. |
| `prisma/migrations/20260717000000_baseline/migration.sql` | Only migration found; does not reproduce the current schema fully. |
| `supabase/rls-policies.sql` | Manual policy setup, separate from migrations. |
| `messages/{en,fr,yo,ha,ig}.json` | Five locale catalogs. |
| `src/__tests__`, `jest.config.js` | 58 Jest suites. Many dependencies are mocked. |
| `scripts/` | Smoke/verification/seed utilities; seed and provider-calling scripts were not executed against unknown hosted data. |
| `public/` | Icons, two manifests, robots rules. |
| `.amelia-source`, `.archive`, historical plans | Legacy/reference material; not treated as a second deployed application. |
| `graphify-out/GRAPH_REPORT.md` | Read first as instructed. Graph commit matches HEAD; working-tree edits are newer than the map. No wiki index exists. Graph includes legacy edges, so active-source relationships were checked directly. |

Assumptions: no isolated test database or designated test accounts were supplied; `.env` contains configured values, but their presence does not prove validity or production configuration. No live record writes, registrations, charges, messages, or clinical AI calls were made. Handler probes used the actual TypeScript code transpiled in memory, real Next request/response objects, and mocked database/Auth/provider boundaries. These prove handler behavior for the supplied conditions, not deployed exploitability or hosted policy state. Scores are engineering judgments, not a compliance certification or exhaustive proof of absence of other bugs.

### Evidence labels

- **R — reproduced:** observed in HTTP checks, command execution, or an isolated executable handler/function probe. Mocked-service reproductions are explicitly identified.
- **M — measured/static fact:** directly measured values or mechanically compared repository artifacts. This is not a rendered-device test.
- **S — suspected / code review:** implementation evidence exists, but the complete behavior was not executed. Conditional deployment risks state the necessary exposure/grant assumptions.

All `File:line` references below are relative to `C:/Users/IKA/Nala Vita` and refer to this audited working tree. Effort: S = usually under a day; M = several days; L = broader design/migration work. These estimates include appropriate regression checks, not just editing a line.

## 2. What I ran

Commands ran in PowerShell from the project root unless a path is explicit. Independent checks were sometimes concurrent. No dependency installation was needed: `node_modules` was present. No formatter, standalone backend build, Docker configuration, or e2e runner is defined in the active project.

| Command / check | Result and qualification |
| --- | --- |
| `git status --short`; `git rev-parse HEAD` | Initial tree had modified login, homepage, SidebarShell, middleware, plus untracked `Searches/`. HEAD was `3e85d5a5ae75a19beef63d3f60fd456000cbff38`. |
| `node --version`; `npm --version` | Node `v26.7.0`; npm `11.19.0`. |
| `npm run lint` | **Failed.** `next lint` is interpreted as directory `.../lint`; Next 16 removed that command. |
| `npx --no-install eslint src --no-cache` | **Failed.** ESLint 9.39.5 cannot find `eslint.config.js/mjs/cjs`; the repository only has `.eslintrc.json`. |
| `npx --no-install tsc --noEmit --incremental false` | **Passed**, exit 0. Tests are excluded by the application tsconfig. |
| `npm run build` | First attempt generated Prisma Client and entered Next compilation, then exited 1 without a final diagnostic. Allocation failures and disk exhaustion occurred in contemporaneous processes; an application compilation defect cannot be inferred from this attempt. A second build was attempted after resources recovered; final outcome is recorded in the final validation notes. |
| `npm test -- --runInBand --no-cache --coverage --coverageReporters=text --collectCoverageFrom='src/**/*.{ts,tsx}'` | **Failed by environment.** Fatal `AlignedAlloc Allocation failed - process out of memory`; no complete all-source coverage result. |
| `$env:NODE_OPTIONS='--max-old-space-size=512'; node node_modules/jest/bin/jest.js --runInBand --no-cache --selectProjects node` | **Passed:** 34 suites, 155 tests. |
| `node node_modules/jest/bin/jest.js --runInBand --no-cache --coverage --coverageReporters=text --selectProjects node` | **Passed:** 34 suites, 155 tests; 62.55% statements, 38.03% branches, 67.17% functions, 63.77% lines **of modules loaded by that run only**. It does not include all untouched routes/components. |
| `$env:NODE_OPTIONS='--max-old-space-size=512'; node node_modules/jest/bin/jest.js --runInBand --no-cache --selectProjects jsdom` | 19 suites/75 tests passed; 5 suites could not run because Jest transform/cache writes returned `ENOSPC`. Exit 1; these are infrastructure failures, not failed assertions. |
| Same jsdom command with `--runTestsByPath src/__tests__/components/MetricCard.test.tsx src/__tests__/components/PageHeader.test.tsx src/__tests__/components/EmptyState.test.tsx src/__tests__/components/amelia/AmeliaLauncher.test.tsx src/__tests__/components/TypingIndicator.test.tsx` | **Passed retry:** remaining 5 suites/13 tests. Thus 58 distinct suites and 243 tests passed across the completed batches. |
| `node node_modules/prisma/build/index.js validate` | **Passed:** current Prisma schema is syntactically valid. No migration was applied. |
| `npm audit --json`; `npm outdated --json` | Initial sandboxed run failed registry access (`EACCES`). Retried with network access: **completed**, reporting 31 vulnerable package entries: 2 critical, 9 high, 19 moderate, 1 low. Outdated returned available updates, which is its normal nonzero condition. No auto-fix or upgrade ran. |
| Compact `npm audit --json` parsed with PowerShell `ConvertFrom-Json` | Used to identify individual advisory names and URLs; see final dependency validation notes. Counts are package entries, not 31 distinct independently exploitable application vulnerabilities. |
| `$env:NEXT_TELEMETRY_DISABLED='1'; npm run dev -- --hostname 127.0.0.1 --port 3100` | **Started.** HTTP checks below ran; server then stopped. Next warned about deprecated middleware convention and a slow filesystem; Turbopack later logged insufficient disk space during cache compaction. |
| In-memory `fetch('http://127.0.0.1:3100'+path, {redirect:'manual', signal:AbortSignal.timeout(15000)})` for seven paths | `/` 200; `/login` 200; `/forgot-password` 404; `/patient/dashboard` 307 to login; `/api/doctors?limit=1` 500 with Prisma `EACCES` in server logs; `/api/appointments` 401; `/api/vitals` 401. Doctor-list failure is a network/environment limitation, not evidence the SQL/query is wrong. |
| CUA browser opening and inventory | Both timed out before usable UI state. No visual inspection claim is made from them. |
| `node C:/Users/IKA/.agents/skills/design-taste-frontend/scripts/inspect.mjs http://127.0.0.1:3100 --out .next/audit-visuals` | **Failed:** Chrome exited early with code `2147483651`. No valid viewport screenshots or Lighthouse/Core Web Vitals metrics were obtained. |
| `node C:/Users/IKA/.agents/skills/design-taste-frontend/scripts/lint.mjs src` | Scanned 244 files; exit 1, 394 style FAIL flags and 226 warnings. These are opinionated heuristics, not 620 product defects. Borders in forms/tables, numeric clocks/bed IDs, brand palettes, and loading skeletons are legitimate examples/false positives. Only context-supported issues are in the findings table. |
| `C:/Users/IKA/.agents/skills/impeccable/scripts/impeccable.cmd context` | Read project context; no PRODUCT.md or DESIGN.md. No context files were created. |
| In-memory schema/migration comparison | Found 3 missing prescription columns and 34 declared index definitions absent from the only migration. Deployed database drift was not inspected. |
| In-memory contrast computation | White on rose 2.10:1; fuchsia 3.46:1; ocean 3.68:1; emerald 2.54:1 using the committed hex tokens. These fail 4.5:1 for ordinary text. |
| In-memory route/function probes | Reproductions listed in section 4. They did not contact hosted services or persist test records. One attempted generic-upload probe could not run because `FormData` was absent from that REPL context; upload concerns remain S. |
| Formatter, integration DB, e2e, actual video call, payment sandbox, production load/bundle/Lighthouse | **Not completed.** No configured formatter/e2e setup; no isolated DB/test identities/provider sandbox; browser launch failed; no successful production performance run. Seed scripts were avoided because their target DB is not established as disposable. |

The disk had approximately 100 MB free at one checkpoint and later recovered to approximately 614 MB without deleting project files. Do not interpret the allocation/ENOSPC failures as source defects or quietly count incomplete checks as passes.

## 3. Findings table

| ID | Area | Severity | File:line | What's wrong | Why it matters | Recommended fix | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | Security | Critical | `src/app/api/auth/register/route.ts:61` | **R:** unverified patient record can be claimed using a supplied phone/email; new Auth email is auto-confirmed. | Knowledge of contact details can attach another person's medical record to an attacker's identity. | Verified, expiring invitation/OTP claim tied to the intended record; atomic one-time binding. | M |
| F02 | Backend | Critical | `src/lib/amelia/llm.ts:259` | **R:** vision outage returns fabricated normal lab findings and claims the image was inspected. | False reassurance can be presented as a reading of an actual lab report. | Return explicit unavailable/unknown result with no extracted values. | S |
| F03 | Backend | Critical | `src/app/api/amelia/chat/route.ts:114`; `src/lib/amelia/engine.ts:15` | **R:** oldest 20 messages are loaded; newest message disappears from model input and red-flag checks after that limit. | A new urgent symptom may never reach emergency detection. | Latest ordered window plus deterministic checking of the submitted message independently of history. | S |
| F04 | Security | Critical | `src/app/api/patients/route.ts:195`, `:262` | **R:** doctor intake finds an existing patient by contact details and immediately creates a confirmed appointment/access relationship. | Doctor can manufacture the relationship required by EHR reads; probe succeeded for an unverified doctor. | Separate intake/identity matching from consented access grants; require verified clinician and patient/authorized-clinic approval. | M |
| F05 | Security | Critical | `supabase/rls-policies.sql:70`, `:126` | **S, conditional:** own-row UPDATE policies do not restrict sensitive columns such as `users.role`, `is_active`, or `doctors.is_verified`. | With table-level UPDATE grants/Data API exposure, a user can promote their own role or a doctor can self-verify. Actual grants were not inspected. | Revoke broad UPDATE; grant only approved columns or use validated server-only mutations. | M |
| F06 | Security | High | `src/app/api/amelia/med-safety/route.ts:52` | **R:** any signed-in application user can supply another `patientId`; victim medications/allergies are passed into analysis. | Unauthorized private health data processing and potentially disclosure in generated findings. | Bind patients to self; require verified clinician plus authorized care relationship for other patients. | S |
| F07 | Security | High | `src/app/api/vitals/route.ts:81`, `:100` | **R:** doctors can query arbitrary patient IDs; doctor with no patients falls back to 20 unrelated patients. | Cross-patient health data exposure. | Remove fallback and enforce care relationship for every supplied target. | S |
| F08 | Security | High | `src/app/api/prescriptions/route.ts:104`; `src/app/api/lab-tests/route.ts:112`; `src/app/api/patients/[id]/notes/route.ts:34`; `src/app/api/referrals/route.ts:32` | **R** for prescriptions, **S** for sibling routes: doctor profile existence replaces verification and target authorization. | Unrelated/unverified clinicians can create clinical entries and notifications. | Use centralized role/status guard and target-specific care authorization before writes. | M |
| F09 | Security | High | `src/lib/auth.ts:66`; `src/app/api/payments/route.ts:144`; `src/app/(doctor)/doctor/dashboard/page.tsx:8` | **R** via deactivated prescription actor; **S** across other routes: central activation/verification guard has no route callers. | Deactivation does not consistently revoke access; unverified doctors remain functional. | Adopt guard on APIs and equivalent authoritative checks in server layouts/pages. | M |
| F10 | Security | High | `src/middleware.ts:35`, `:48`; `src/lib/auth-cache.ts:12`; `src/app/api/search/route.ts:11` | **S:** server authorization trusts `getSession()` cookie user data; middleware role comes from editable `user_metadata`; layouts only require a session. | Cookie/claim tampering or metadata edits may bypass page gates; APIs using getUser do not fix direct server-page reads. No forged-cookie attack was executed. | Verify identity with getUser/getClaims as appropriate, resolve DB role/status, and enforce at data access boundaries. | M |
| F11 | Security | High | `src/app/api/appointments/[id]/route.ts:64`, `:74` | **R:** appointment payload includes hidden self-added medications and private notes without privacy predicates. | Alternate API path bypasses record-sharing controls; patient callers can also receive clinician-private notes. | Apply caller-specific field and row visibility consistently before serialization. | M |
| F12 | Backend | High | `src/app/api/appointments/[id]/route.ts:128`, `:142`, `:151` | **R:** involved patient can set any appointment status and edit notes; cancelled appointment changed to completed. | Clinical/payment workflow state and clinician notes can be falsified. | Role-specific allowed operations and state-transition rules with conditional writes. | S |
| F13 | Backend | High | `src/app/api/appointments/route.ts:136`, `:161` | **R, simulated concurrency:** overlap read is outside transaction; two simultaneous bookings both return 201. | Double-booking and duplicate payment obligations. | Database exclusion/locking or serializable conflict check with retry, covering doctor and patient schedules. | M |
| F14 | Backend | High | `src/app/api/appointments/route.ts:116`; `prisma/schema.prisma:107` | **R** unverified doctor accepted; **S** for other cases: booking only verifies existence, not activation, future time, working hours, integer duration, or patient conflicts. | Users can reserve invalid or unavailable clinical slots. | Validate authoritative availability and constrained integer inputs server-side. | M |
| F15 | Backend | High | `src/app/api/payments/webhook/route.ts:89`, `:105` | **R:** duplicate success events re-notify and reconfirm cancelled appointments; supplied amount/currency are not compared with expected payment. Unknown references can still reach appointment update. | Incorrect settlement and appointment state, duplicate notifications. HMAC verification itself is present. | Exact payment binding, amount/currency verification, event idempotency, guarded transitions in one transaction. | M |
| F16 | Backend | Medium | `src/app/api/payments/route.ts:201`, `:213`; `prisma/schema.prisma:326` | **S:** repeated checkout initialization overwrites the sole reference; external call precedes durable attempt storage; money uses Float. | Earlier successful attempts can become untracked; parallel retries and reconciliation are ambiguous. | Durable PaymentAttempt with unique reference/idempotency; fixed minor-unit integer or Decimal money. | M |
| F17 | DevOps | High | `prisma/schema.prisma:186`; `prisma/migrations/20260717000000_baseline/migration.sql:107`, `:347` | **M:** migration lacks `added_by`, `is_shared_with_doctor`, `usage_logs`, plus 34 current index definitions. | Fresh migrated database cannot satisfy current prescription queries; expected performance indexes are not reproducible. | Add reviewed forward migration and fresh-database CI verification. | M |
| F18 | Security | High | `prisma/migrations/20260717000000_baseline/migration.sql:296`; `supabase/rls-policies.sql:438` | **M/S, conditional:** migrations enable no RLS; manual policy script omits Amelia conversations/messages/memories/reminders. | Exposed/granted new tables could leak sensitive AI history and memory. Hosted RLS/exposure was not verified. | Version RLS/grants for every exposed table; verify anon/patient/doctor/admin isolation. | M |
| F19 | Security | High | `src/components/chat/ChatWindow.tsx:117`, `:288`; `src/components/telemedicine/VideoCallPanel.tsx:64`, `:190` | **S, conditional:** predictable broadcast topics are used without private-channel configuration; incoming payload identity is trusted. | If public Realtime channels are enabled, unauthorized subscribers may read/inject chat or signaling; table RLS does not protect broadcast messages. | Private channels with membership policies, verified signals, and server/database-originated message events. | L |
| F20 | Frontend | High | `next.config.mjs:37`; `src/components/telemedicine/VideoCallPanel.tsx:175` | **M:** all pages receive `camera=(), microphone=()` while video UI calls getUserMedia. | Permissions policy denies the media features required by telemedicine in supporting browsers. | Permit self on consultation pages and retain narrow restrictions elsewhere. | S |
| F21 | Backend | High | `src/app/(patient)/patient/vitals/page.tsx:64`, `:235`; `src/app/api/vitals/route.ts:10`; `src/app/(doctor)/doctor/dashboard/page.tsx:94`, `:121` | **M:** Fahrenheit is stored unchanged, while dashboard thresholds/labels assume Celsius. | Ordinary 98.6°F can be shown as 98.6°C and treated as critical. | Canonical stored units with explicit input/display conversion and shared thresholds. | M |
| F22 | Frontend | High | `src/app/(patient)/patient/pharmacy/page.tsx:56`, `:79`; `src/app/api/medications/route.ts:249` | **S:** pharmacy expects an array but API returns `{medications,...}`; order action only changes local state. | Existing prescriptions disappear; apparent orders are never sent anywhere. | Parse the actual contract and implement orders or clearly disable the unavailable service. | M |
| F23 | UX | High | `src/app/(admin)/admin/beds/page.tsx:92`, `:115`; `src/app/(admin)/admin/staff/page.tsx:154` | **S:** bed assignments/discharges and added staff are local simulated changes. Staff form offers nurses despite no nurse model/role. | Hospital operators can believe operational records were saved when refresh discards them. | Persist authorized operations transactionally or clearly designate these as demos/unavailable. | L |
| F24 | UX | Medium | `src/app/(admin)/admin/dashboard/page.tsx:48`, `:108`, `:191`; `src/app/(doctor)/doctor/analytics/page.tsx:52` | **S:** hardcoded metrics, critical alerts, and analytics look live. | False operational/clinical information can influence decisions. | Real aggregates or explicit demo/empty states; remove arbitrary delay spinners. | M |
| F25 | UX | Medium | `src/app/api/auth/register/route.ts:217`; `src/app/api/admin/staff/route.ts:80`, `:102` | **S:** registration promises verification, but staff API/UI cannot approve `isVerified`. | Legitimate clinician onboarding has no in-product completion path; out-of-band SQL would be required. | Admin-only audited verification workflow with explicit pending status. | M |
| F26 | Frontend | High | `src/app/(doctor)/doctor/layout.tsx:16`; `src/components/amelia/AmeliaLauncher.tsx:115`; `src/app/api/amelia/chat/route.ts:71` | **S:** doctor launcher renders patient-only AmeliaChat; chat API requires patient profile. | Doctor-facing assistant/prompts lead to 404 rather than a usable clinician workflow. | Dedicated clinician assistant contract/authorization or remove launcher until supported. | M |
| F27 | A11y | High | `src/app/globals.css:17`; `src/app/(auth)/login/page.tsx:146`; `src/components/settings/SettingsPanel.tsx:895` | **M:** white ordinary text on all four primary colors fails 4.5:1; rose is 2.10:1. | Core sign-in/save actions fail WCAG 1.4.3 contrast. High-contrast yellow primary also needs a dark foreground. | Separate accessible action/foreground tokens; verify every theme pair. | S |
| F28 | A11y | Medium | `src/app/(auth)/login/page.tsx:87`, `:106`, `:123`; `src/components/settings/SettingsPanel.tsx:825` | **S:** visible labels lack htmlFor/input IDs; password toggle lacks accessible name; errors lack field associations/live announcements. | Screen-reader users cannot reliably identify fields or validation feedback. | Proper IDs/labels, aria-invalid/describedby, toggle name, and error announcements. | S |
| F29 | A11y | Medium | `src/components/ui/modal.tsx:43`; `src/components/layout/SidebarShell.tsx:211` | **S:** modal lacks dialog semantics, focus management/trap/restore and accessible close name; mobile overlay needs equivalent keyboard review. | Keyboard/screen-reader users can interact behind the overlay or lose context. | Accessible dialog primitive, inert background, title association, initial/return focus. | M |
| F30 | A11y | Medium | `src/app/layout.tsx:29` | **M:** maximumScale is 1. | Attempts to prevent user zoom harm low-vision users; browser enforcement varies. | Remove maximumScale constraint; test reflow and 200–400% zoom. | S |
| F31 | Frontend | Medium | `src/app/(patient)/patient/vitals/page.tsx:238`; `src/app/(admin)/admin/staff/page.tsx:123`; `src/hooks/useVitals.ts:18` | **S:** fetch success is assumed without checking HTTP status; optimistic staff changes are not rolled back. | 401/422/500 can look saved, and form input can be discarded. | Throw on non-2xx, retain drafts, show specific errors, rollback/invalidate safely. | M |
| F32 | Backend | Medium | `src/app/api/notifications/route.ts:29`; `src/lib/amelia/reminders.ts:21`, `:98` | **S:** reminders fire only when notifications are requested; delivery and schedule update are separate; calculations use server-local timezone. | Closed app gets no timely reminder; concurrent polls can duplicate alerts; patient local time may differ. | Scheduled worker, atomic due-job claims, explicit IANA timezone, idempotent delivery. | M |
| F33 | Backend | Medium | `src/lib/amelia/reminders.ts:41`; `src/lib/amelia/llm.ts:48` | **R:** OpenAI model option `gpt-4o-mini` is forwarded to Gemini's model field. | Reminder extraction uses an incompatible provider model identifier and relies on fallback. | Provider-specific model settings; never forward one provider's model ID to another. | S |
| F34 | Backend | Medium | `src/lib/amelia/llm.ts:129`, `:138`, `:160`, `:169` | **S:** after yielding part of a response, stream exceptions fall through to a new provider response without reset. | Users can receive concatenated contradictory partial answers. | Track emitted state outside catch; stop with a recoverable interrupted event or explicit replacement protocol. | M |
| F35 | Backend | Medium | `src/app/api/payments/route.ts:12`; `src/app/api/amelia/chat/route.ts:150`; `src/lib/amelia/llm.ts:47` | **S:** no explicit application deadline/request-cancellation propagation on key service operations. | Slow providers can hold requests and continue billable work after client disconnect. SDK defaults do not define the app's total latency budget. | Bounded deadlines, abort propagation, selective retries and observable degraded states. | M |
| F36 | Security | Medium | `src/app/api/upload/route.ts:40`, `:49`, `:76`, `:97`; `src/app/api/amelia/chat/route.ts:15` | **S:** generic upload trusts MIME and buffers multipart before size check; storage is not compensated on signing/DB failure; chat image string has no analogous length/type cap. | Resource abuse, disguised files, and orphaned PHI objects. The newer chat-attachment endpoint does sniff signatures and compensate some failures. | Shared bounded upload pipeline, content validation, quotas, cleanup, limited image schemas. | M |
| F37 | Security | Medium | `src/app/api/auth/register/route.ts:50`; `src/app/api/ai/tts/route.ts:15`; `src/lib/rate-limit.ts:108` | **S:** registration has no limiter/CAPTCHA; TTS permits anonymous paid generation keyed by forwarded header; Redis is absent from local env and fallback is process-local. | Auth spam and provider-cost abuse; limits do not reliably span serverless instances. | Distributed limits, authenticated TTS, trusted proxy IP derivation, signup abuse controls. | M |
| F38 | Perf | Medium | `src/app/api/notifications/route.ts:40`; `src/app/api/vitals/route.ts:74`; `src/app/api/payments/route.ts:55` | **S:** some query limits are unbounded/unvalidated and several clinical/payment lists have no pagination. | Large queries, invalid-input 500s, growing transfer/render cost. Messages already clamp limits, which can be reused. | Shared bounded pagination schema and cursor-based list contracts. | M |
| F39 | Perf | Medium | `src/app/api/messages/route.ts:54`; `src/app/api/messages/_access.ts:47`, `:80` | **S:** conversation list does several authorization/detail/count queries for every partner. | Query fan-out grows with conversation count and can exhaust the 15-connection pool per process. | Batch membership/partner lookup, latest messages, unread aggregates; paginate conversations. | M |
| F40 | Backend | Medium | `src/app/api/medications/route.ts:147`, `:211`, `:231` | **S:** adherence denominator is calendar days, not prescribed dose opportunities; new/inactive medications can distort seven-day results. | Clinical adherence percentages can be misleading for twice-daily/new/stopped therapy. | Model scheduled dose events, start/end dates, timezone and PRN semantics. | L |
| F41 | UX | Medium | `src/components/settings/SettingsPanel.tsx:246`, `:259`, `:959`; `src/app/(patient)/patient/dashboard/_components/PatientDashboardClient.tsx:165` | **S:** unit/notification settings only write localStorage with no consumers found outside settings; Daily Vitals widget has no persistence callback. | Controls promise behavior they do not change; daily tracking is lost on navigation/reload. | Wire shared preferences and actual delivery/persistence, or label/disable unsupported controls. | M |
| F42 | Security | Medium | `src/app/api/auth/register/route.ts:126`; `src/app/api/patients/route.ts:296`; `src/lib/audit.ts:87` | **S:** direct audit writes bypass the sanitizer, include contact data, and often swallow errors. Many clinical operations do not use the shared audit helper. | Claimed redaction/traceability is inconsistent; audit loss is silent. PHI in logs is a retention/access-design issue, not by itself a legal conclusion. | Central structured minimized audit events, restricted access, failure monitoring/outbox and retention policy. | M |
| F43 | UX | Medium | `src/app/page.tsx:107`; `src/components/settings/SettingsPanel.tsx:1033`, `:1051`, `:1154`; `src/components/chat/ChatWindow.tsx:341` | **S:** compliance/security claims, provider Operational status, and chat Online indicator are unconditional. | Users are given assurances not established by current implementation or live status. | Only show verified claims and actual health/presence; get applicable organizational/legal sign-off before compliance statements. | S |
| F44 | DevOps | Medium | `package.json:12`; `.eslintrc.json:1` | **R:** both documented lint command and direct ESLint invocation fail. | Lint offers no effective quality gate under the installed major versions. | Flat ESLint config and `eslint .` script aligned with Next 16. | S |
| F45 | `package.json`, `package-lock.json` | Full and runtime audits before and after compatible remediation, then Prisma generation and regression suites. | `eb448c7` | Partially fixed. Runtime audit is clear. Full audit retains 27 development entries (4 low, 23 moderate) through Jest/ESLint. Next/config are 16.4.5, Prisma CLI/client/adapter are 7.10.1, Zod is 4.6.6. TypeScript, 36 focused tests and 75 Node suites / 392 tests passed. Breaking downgrades suggested by npm were left pending. |
| F46 | DevOps | Medium | `jest.config.js:14`, `:33`; `src/__tests__/api/patient-records-lifecycle.test.ts:1` | **M:** tests are mostly mocked units; Node transform disables diagnostics; markdown rendering is mocked; no real DB/RLS/e2e suite found. | Happy-path tests pass despite reproduced security flaws; current coverage is not a release gate. | Prioritize negative authorization, fresh migrations, payment replay, AI outage/history, and browser journeys. | L |
| F47 | DevOps | Medium | `README.md:1`; `package.json:5`; `.env.example:46`; `CLAUDE.md:3` | **M/S:** README is starter text; no CI/container/health-runbook setup found; framework docs are stale; OpenAI fallback key is absent from env example. | Setup, deploy, recovery and checks are not reproducible; billing/webhook/env expectations are unclear. Containers are optional, not mandatory. | Add real setup/deploy/test runbook, CI gates, readiness checks, environment ownership and service configuration. | M |
| F48 | UI | Medium | `src/app/globals.css:47`; `src/components/settings/SettingsPanel.tsx:843`; `src/components/providers/ThemeProvider.tsx:13` | **S:** partial dark theme plus hardcoded light surfaces/foregrounds; brand theme and brightness share one theme selector. | Inconsistent theme coverage and limited ability to combine brand palette with dark mode. No rendered contrast audit completed. | Separate brand/surface tokens and audit complete screens in all supported combinations. | M |
| F49 | Frontend | Medium | `src/components/layout/SidebarShell.tsx:139`; `src/components/settings/SettingsPanel.tsx:925`; `src/app/layout.tsx:83` | **S:** many visible strings/date formats remain English despite five locales; full catalogs are serialized at root despite comment claiming namespace scoping. | Locale selection only partially translates the product and adds unnecessary payload. | Translate complete journeys, locale-aware formatting, scoped message delivery and missing-key tests. | M |
| F50 | Frontend | Low | `public/robots.txt:15`; `public/manifest.json:9`; `src/app/layout.tsx:66` | **M/S:** robots advertises a sitemap route not found, manifest only declares ICO, private routes inherit public index metadata; no service worker registration found. | Incomplete SEO/installability; robots exclusion alone is not a security control. Offline support was not claimed or tested. | Correct canonical/sitemap setup, private noindex, proper install icons; define PWA scope before adding PHI caching. | S |
| F51 | Frontend | Medium | `src/hooks/useVitals.ts:5`; `src/hooks/useMessages.ts:9`; `src/components/layout/SidebarShell.tsx:65`; `src/providers/index.tsx:8` | **S:** query keys omit user identity and logout does not explicitly clear root QueryClient. Several fetchers cache HTTP error JSON as success. | In-session account switches may reuse prior user data; error/retry semantics are wrong. Hook usage/reproduction needs follow-up. | User-scoped keys, cache clear on auth changes, and shared non-2xx error handling. | S |
| F52 | A11y | Medium | `src/components/amelia/AmeliaLauncher.tsx:63`, `:125`; `src/components/telemedicine/VideoCallPanel.tsx:375`; `src/components/chat/ChatWindow.tsx:143` | **S:** no intentional reduced-motion handling found in these paths; fixed/viewport dimensions and five video controls need narrow-screen/touch verification. | Motion/keyboard comfort and 320px mobile layout may suffer. No overflow or gesture defect was visually confirmed. | Test 320/390/768/1440px, zoom, keyboard, reduced motion; use dynamic viewport sizing and wrap controls. | M |
| F53 | Backend | Medium | `src/lib/amelia/medsafety.ts:74`, `:83`, `:90` | **S:** invalid/non-JSON analysis becomes empty findings; successful-looking result has no unavailable status and is cached without expiry. | Provider degradation can resemble no interactions; PHI-derived cache grows and guidance can stay stale. | Validate structured provider output, return incomplete/unavailable explicitly, use bounded TTL cache with versioned keys. | M |

### What is working reasonably well

The schema has useful foreign keys and current index intentions; appointment/payment creation and prescription/notification creation use transactions. Most API paths use Supabase `getUser()` and explicit JSON errors. The newer messaging attachment path uses opaque authorized URLs, sender/receiver binding, byte signatures, size/type checks, no-store responses, and cleanup attempts. HMAC webhook validation uses timing-safe comparison. Deterministic emergency short-circuit logic exists in the Amelia engine; F03 prevents it receiving the correct input in long conversations. Local font files, parallel dashboard queries, shared UI primitives, five locale catalogs, and the existing tests provide a foundation to preserve.

No raw SQL construction, command execution from request data, broad wildcard CORS configuration, or direct browser exposure of the service-role key was found in the reviewed active paths. The only `dangerouslySetInnerHTML` reviewed is a static root-layout script, not user content. This does not certify all injection/CSRF/XSS paths: browser execution, deployed cookie settings, storage policies, external provider configuration, and hosted database grants remain unverified.

## 4. Bugs and wrong behavior: reproductions

### Isolated executable probes

The audit loaded real modules with `typescript.transpileModule` targeting CommonJS/ES2022 into `node:vm`. A custom require supplied mock Prisma, Supabase, and provider modules. Real `next/server` NextRequest/NextResponse objects handled requests. No probe files were written and no real users/data were used. Repeat these cases in a committed regression suite after fixes are authorized; run any HTTP equivalents only against an isolated seeded environment.

| Case | Setup and steps | Observed result | Expected |
| --- | --- | --- | --- |
| F01 claim | Stub no user for attacker email; stub an unverified patient for supplied phone; POST valid patient registration with that phone and attacker-controlled email. | 201; Auth createUser received `email_confirm:true`; victim User updated with attacker Auth ID/email and `emailVerified:true`. | No binding until verified one-time claim proof. |
| F02 vision outage | Load llm.ts with neither provider key, call visionChat with invalid image data. | JSON contains `flag:"normal"`, a fabricated panel, and text saying values appear within expected parameters. | Explicit unreadable/unavailable; no findings. |
| F03 old history | Seed mock conversation with 20 old messages; POST a new message with `stream:false`; mock findMany honors ascending/take 20. Capture engine input. | 200; engine received exactly the old 20 messages, with `newMessageReachedEngine:false`. | Latest submitted message always included and independently screened. |
| F04 intake access | Doctor user has no relationship and `isVerified:false`; existing patient matched by email; POST valid intake data. | 201; new CONFIRMED appointment created linking doctor to existing victim patient. | Approved access grant required before link or EHR disclosure. |
| F06 safety IDOR | Signed-in patient A; POST `{patientId:"victim-p"}`; victim mock has private medication/dose/allergy. Capture analyzeMedications arguments. | 200; victim medication/dose and allergy passed to analysis. | 403/404 before loading victim data. Actual provider output leakage was not executed. |
| F07 vitals fallback | Doctor has zero linked patients; mock first scoped query returns []; second returns unrelated patient/vitals. GET `/api/vitals`. | 200 with unrelated patient/vitals; second query had no relationship filter. | Empty scoped list. |
| F08/F09 unauthorized prescribing | Authenticated user has `isActive:false`, doctor `isVerified:false`, no care relationship; target exists. POST prescription fields. | 201 and prescription creation for unrelated patient. | 403 before write/provider work. |
| F11 privacy | Appointment belongs to requesting doctor; related patient has another doctor's private note and an unshared self-added medication. GET appointment. | 200 serialized both fields unchanged; query has no privacy predicates. | Caller-specific filtered data. |
| F12 state | Patient owns a CANCELLED appointment. PATCH `{status:"COMPLETED", notes:"patient edited notes"}`. | 200; update accepted both fields. | Denied transition/notes update. |
| F13/F14 booking | Two concurrent POSTs target same doctor/time; barrier makes both overlap reads finish before either creates; doctor mock is unverified. | `[201,201]`; two appointments created. | One booking; other 409, and unverified doctor denied. No real database concurrency test ran. |
| F15 webhook | Mock payment already COMPLETED; appointment cancelled; send same locally HMAC-signed charge.success twice with mismatched amount/currency. | `[200,200]`; appointment set CONFIRMED twice; four notifications; mismatched amount/currency accepted. | Replay no-op; mismatch rejected/flagged; terminal state preserved. |
| F33 provider model | Call chat with `{model:"gpt-4o-mini"}`, fake Gemini key, stub Gemini generateContent to capture input. | Gemini received model `gpt-4o-mini`. | Provider-specific supported Gemini model. |

### HTTP and deterministic findings

Visit `/login`, follow Forgot password: the target `/forgot-password` returned 404. That defect affects both login and settings reset links (`src/app/(auth)/login/page.tsx:110`, `src/components/settings/SettingsPanel.tsx:1109`) and needs a complete reset request/callback/update flow, not merely a placeholder page. The development server returned 401 for unauthenticated appointment/vitals requests and redirected the protected patient dashboard to login, which is the correct baseline.

Read the actual Permissions-Policy response header: camera and microphone were disabled globally. This is sufficient to identify conflict with the video feature; a physical camera test was not run. Contrast ratios were calculated directly from sRGB token values; actual inherited/hover/disabled theme combinations still need browser verification. Schema/migration comparison proves missing definitions in versioned artifacts; it does not prove those columns/indexes are absent from the existing hosted database.

Additional code-review reproduction candidates (S): pharmacy always discards the medications object as a non-array; adding staff or assigning a bed then refreshing loses the change; vitals form receiving HTTP 422 still clears input and shows success; submitting 98.6°F is interpreted as 98.6°C by the doctor dashboard. These were traced through source but not driven through a rendered UI.

## 5. Concrete fixes for every Critical and High issue

Suggestions below are reviewable implementation directions, not applied patches. They need the negative tests in section 9. Resolve the shared authorization model once and use it across server-rendered data, handlers, SQL policies, and Realtime.

### F01 — secure claims

Remove the contact-match-and-bind branch. Keep provisional records unbound until a record-specific invitation token or OTP is verified against its intended recipient; store a hash, expiry, target record, and consumed timestamp. After verification, use a transaction/conditional update on the still-unclaimed record; compensate Supabase Auth creation if DB persistence fails. Do not call admin createUser with `email_confirm:true` for an unproven address. Never allow two simultaneous claim requests to bind the same record.

### F02 — fail visibly on unreadable labs

Replace the entire fabricated fallback object in `visionChat` with a typed provider-unavailable error, or `{status:"unavailable", results:[], summary:"The report could not be read. Please retry."}`. Propagate that status through extractLabsFromImage and both image/chat endpoints. Neither generated context nor UI should use a fallback to assert a normal result. Add tests for no keys, both providers rejecting, invalid image data, and malformed model JSON.

### F03 — newest message and emergency checks

Fetch history with `orderBy:[{createdAt:"desc"},{id:"desc"}]`, take the desired recent window, then reverse before sending to the model. Inspect the raw submitted `message` with deterministic red-flag checks before relying on the truncated history, and make sure the newly persisted message is present exactly once. Test the 19/20/21-message boundary and new urgent symptoms in a much longer conversation for both JSON and SSE paths.

### F04 — separate identity matching from access

Do not automatically create a CONFIRMED appointment when matching an existing patient by phone/email. Introduce a pending care invitation/access grant with patient approval or a documented authorized clinical-intake process. Return minimal matching information before authorization. Resolve physician verification/activation before intake, and make the final consented relationship creation atomic and audited. Direct patient record sharing should create a grant rather than invent a clinical appointment.

### F05 — column privileges

Audit actual `information_schema.column_privileges`/table grants first. Revoke table-level UPDATE from client roles before allowing safe profile columns, for example `GRANT UPDATE (first_name,last_name,phone,avatar_url) ON public.users TO authenticated`; keep `role`, `is_active`, identity bindings, email verification, and doctor verification server-only. Preserve ownership RLS, restrict policy functions' search_path/execute exposure, and verify an ordinary user's direct REST update cannot promote role. Apply changes through a versioned migration, not an undocumented dashboard tweak. [Supabase column-security documentation](https://supabase.com/docs/guides/database/postgres/column-level-security) explains the table/column privilege distinction.

### F06–F09 — one guard, then target authorization

At the top of clinician mutations use the existing `requireApiUser({roles:["DOCTOR"],profile:"doctor"})`; it already rejects inactive/unverified doctors. After parsing target ID, require `doctorHasPatientAccess(auth.user.doctor.id, patientId)` or a stricter consented-access equivalent before selecting target data or writing. For patients, always derive patient ID from the authenticated DB profile and reject other supplied IDs; allow admins only where explicitly intended. Remove vitals' unscoped fallback. Use the same enforcement for lab orders, notes, referrals, medications, safety analysis, payment access, and server dashboards. The existing helper is not enough if F04 can manufacture its qualifying appointment.

### F10 — authoritative server identity

Replace server authorization use of cookie-derived getSession user objects with validated identity (getUser or verified getClaims, chosen according to revocation requirements) and resolve the database role/activation/verification. Middleware may redirect for convenience but each layout/data-access boundary must independently enforce its intended role. Do not authorize with editable user_metadata. When a refresh produces cookies, preserve them on redirect responses as well as the pass-through response. [Supabase's SSR guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs) describes verified identity choices.

### F11 — central visibility rules

Create a caller-aware clinical selector. For a doctor, hide patient-added medications unless shared, and return private notes only when the doctor is their permitted author; for a patient, follow the explicit clinician-private-note policy. Apply identical rules to appointment detail, EHR detail, records, exports and AI patient context. Avoid fetching a whole EHR until caller relationship checks pass. Add a cross-endpoint privacy test that marks an item private and checks every alternate read surface.

### F12 — appointment operations, not arbitrary status assignment

Give patients an explicit cancellation operation; reserve clinical notes and IN_PROGRESS/COMPLETED/NO_SHOW transitions to authorized clinicians. Define allowed state transitions and use `updateMany`/transaction predicates including current status; return 409 when a racing transition loses. A cancelled/completed appointment must not be freely reopened, including by webhook. Test every role against every transition.

### F13–F14 — atomic, valid scheduling

Validate active/verified doctor, future scheduled time, service duration as an integer, declared availability, timezone, and patient conflicts. Execute overlap protection atomically: a PostgreSQL range exclusion design is preferable; alternatively use a transaction-scoped lock for the schedule followed by overlap read/create, or Serializable transactions with bounded retry. A uniqueness constraint on identical start times alone does not prevent overlapping unequal durations. Persist payment only after valid reservation inside the same transaction.

### F15 — idempotent settlement

Require an existing payment attempt with a unique provider reference, compare exact expected minor-unit amount/currency and bound appointment/patient, and validate event shape. Store a unique provider event/transaction identifier. In one transaction, claim an unapplied settlement event, complete the matching payment, conditionally confirm only a permitted scheduled appointment, and enqueue each notification once. Unknown references/mismatches should be reconciled, not used to confirm metadata-selected appointments. Duplicate valid events should acknowledge receipt with zero new side effects. Failure/reversal processing needs equally monotonic transitions and retryable failure handling.

### F17 — reproducible schema

Generate a new forward migration containing the three prescription columns with safe defaults/backfill, plus reviewed indexes that match the current schema. Do not edit the already-deployed baseline. Apply to a disposable database from scratch and compare its schema with Prisma before deployment. Check for out-of-band changes in the hosted database and reconcile migration history deliberately.

### F18 — version all policy state

Enable RLS and define explicit ownership/membership policies for all exposed AI tables; revoke unnecessary anon/authenticated grants. Include this in the same migration/deploy lifecycle as table creation. Test both ordinary table REST access and Realtime separately. Prisma's direct PostgreSQL credentials and database role are distinct from a Supabase HTTP service-role key; correct the misleading comment in `rls-policies.sql:14` when maintaining this setup. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) is the relevant reference.

### F19 — private realtime membership

Use channels configured with `{config:{private:true}}` and Realtime authorization policies proving the authenticated user belongs to the specific chat/appointment. Broadcast authoritative message notifications from a trusted server or subscribe to RLS-protected database events, then map snake_case database fields to the client type. Treat incoming client-supplied sender IDs and SDP as untrusted; validate membership and signal schema. Predictable topic names are acceptable only when access is enforced.

### F20 — permit the actual consultation features

Change consultation response policy to `camera=(self), microphone=(self)` while keeping unrelated features restricted. Prefer route-scoped policy rather than enabling media everywhere by accident. Verify with a real two-party call over HTTPS/localhost, device denial/retry, joining in both orders, and mobile browsers. The [camera directive documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Permissions-Policy/camera) describes the denial behavior. STUN-only ICE and the no-peer-ready signaling handshake also need a reliability review before calling telemedicine ready.

### F21 — explicit clinical units

Choose canonical storage units (for example temperature Celsius) and introduce validated unit-aware input conversion. Version/backfill existing values using their known source rather than guessing from magnitude. Share conversion/threshold functions across vitals API, dashboard, monitoring, charts and AI context. Test 98.6°F equals 37°C end to end and that display preference does not change clinical interpretation.

### F22–F23 — truthful, persisted actions

For pharmacy, read `data.medications`, not Array.isArray(data); then implement an authorized PharmacyOrder model/API with durable status and idempotent requests, or disable the order action with clear availability copy. For staff/beds, replace local mutations with validated authorized APIs, concurrency checks, transactions and success only after persistence. Define nurse accounts/workflows explicitly if offered. Until implemented, keep these screens clearly out of operational use as demos. Reload-after-save tests are essential.

### F26 — clinician assistant contract

Implement a clinician-specific endpoint/audience that uses a verified doctor profile and explicitly authorized patient context; route the launcher to it. Do not work around the 404 by attaching a patient profile to every doctor. If this workflow is out of scope, remove the launcher/clinical prompt affordances from doctor layout until it can work.

### F27 — accessible action tokens

Introduce separate `--action-background` and `--action-foreground` pairs with at least 4.5:1 for ordinary text and supported states. Retain pale rose as a tint/brand token rather than the white-text action fill. Audit primary links on white as well as buttons; in high-contrast mode use dark text on yellow. Give login/settings forms explicit label/error semantics while touching them. Validate focus and disabled states in all themes.

### F45 — dependency remediation

Use the dated advisory summary in the final validation notes. Upgrade within compatible ranges first and keep Next/eslint-config-next and Prisma/client/adapter versions intentionally aligned. Run `npm audit --omit=dev` as well as full audit to distinguish deployable from build-tool risks, and assess actual call-site reachability. Do not blindly run `npm audit fix --force`: the audit suggested some major-version downgrades, including Jest/ESLint tooling, which could break this stack. Review lockfile changes, test migration/build/auth paths, and rerun the audit.

## 6. Enhancements and improvements

### Backend

- Create one explicit consent/care-access model instead of overloading appointments for intake and record sharing (`patients/route.ts:262`, `patients/share/route.ts:60`). It prevents access grants from contaminating schedules, metrics and payment assumptions.
- Consolidate duplicate prescription/medication contracts (`api/prescriptions/route.ts:77`, `api/medications/route.ts:271`), use typed DTOs, and document error envelopes and cursor pagination in OpenAPI. JSON parse errors should map to 400 rather than generic 500.
- Use durable job/outbox processing for notifications, reminders and provider reconciliation; multi-step registration/profile/referral operations need transaction/compensation boundaries. Failures after a successful write should not return a misleading retryable response that duplicates the original action.
- Add structured request IDs, provider latency/error metrics, health/readiness endpoints and alerting. Define minimum logging/retention data deliberately; do not claim that a generic key-name filter proves de-identification.
- Harden model-output schemas and expose provider/degraded status. The deterministic clinical fallback contains generic medication/symptom advice and assertions such as pre-prescribing allergy alerts (`clinical-engine.ts:185`) that need a clinician-owned content review. This audit does not validate medical advice.
- Add a real refill lifecycle. The current refill endpoint only creates a notification (`medications/[id]/refill/route.ts:54`), without a durable request, approval/dispensing operation or duplicate-request control.

### Frontend

- Standardize API consumption with typed success/error results, AbortController handling and user-scoped cache keys. Keep drafts and undo/rollback when requests fail.
- Load the latest chat window, support history pagination, and reconcile live events with authoritative history. Current message API uses ascending first 50 (`messages/route.ts:122`) while ChatWindow has no older/newer pagination, so long threads need explicit repair.
- Replace imperative DOM prompt injection (`AmeliaLauncher.tsx:44`) with controlled React input state; changing native input.value may not update the controlled message state reliably.
- Split large domain screens into tested workflow components. Records/settings/medications screens combine extensive local state, rendering and request logic, increasing regression risk.
- Verify WebRTC join-order, ICE buffering/retry, disconnect feedback, TURN relay, and cleanup of screen-sharing tracks. `VideoCallPanel.tsx:277` closes over toggle state and display tracks are not held in the cleanup ref; this requires runtime media tests rather than assuming the happy path works.

### UI design

- Preserve the existing brand, shared PageHeader/SectionCard/EmptyState primitives and local typography. Establish accessible surface/text/action/status tokens before adding more theme variants.
- Replace unverified live-looking numbers, Operational/Online indicators and simulated save confirmations with real system states. This would improve trust more than decorative restyling.
- Reduce competing card treatments/gradients and inconsistent saturated accents where they obscure hierarchy; form/table borders and clinical status colors have legitimate uses. The style detector's counts should not become an automatic removal checklist.
- Review full screens visually at desktop/tablet/phone, in every supported brightness/brand combination. No claim is made that current spacing/alignment/responsiveness was visually signed off.

### UX

- Finish account recovery, pending verification and approved record-claim flows. Explain what the user must do next rather than sending every login to a dashboard that may reject them.
- Give privacy switches one consistent, testable meaning across EHR, appointment, AI and transfers. Separate patient-hidden data from clinician-private notes instead of overloading one Boolean.
- Prefer one clear task per screen; group role navigation by clinical work and reduce the memorization needed to distinguish records, prescriptions, medications and pharmacy.
- Make unit preferences, reminders and notification-delivery copy describe actual behavior. Do not promise SMS 15 minutes before a call when no such delivery mechanism is wired.
- Provide useful recovery for empty, offline, unauthorized and provider-unavailable states. Distinguish no data from failed data loading.

## 7. Quick wins (typically under one hour each)

These are candidates after approval, not fixes already made. Security work with broad authorization/migration implications still needs meaningful tests even if the edit is short.

| Action | Impact |
| --- | --- |
| Remove fabricated lab-normal fallback; return explicit unavailable (F02). | Stops a particularly unsafe false-success response. |
| Independently screen latest submitted message and correct recent history order (F03). | Restores current-turn processing and urgent-input coverage. |
| Remove unscoped vitals fallback, rejecting unauthorized targets (F07). | Immediately closes one cross-patient read path. |
| Disable insecure provisional record claiming pending a proper verified claim flow (F01). | Containment; complete claim redesign is not an hour-long task. |
| Replace global media denial on consultation routes (F20). | Removes a concrete video blocker. |
| Parse pharmacy `data.medications`; disable fake order submission (F22). | Restores listing and stops fictitious order feedback. |
| Check response.ok before clearing vitals form (F31). | Prevents silent lost input and false save messages. |
| Remove maximumScale and name password/close controls (F28–F30). | Improves basic accessibility with limited implementation risk. |
| Correct unsupported status/compliance indicators and mark demos (F23/F24/F43). | Restores honesty while backend work is pending. |
| Replace broken lint script and create a compatible flat config (F44). | Restores a useful engineering gate; running/fixing all existing violations takes longer. |

## 8. Prioritized roadmap

### Now — this week

Contain F01–F04 immediately; fix latest-turn handling and unavailable lab results before more feature work. Audit actual hosted grants/RLS and verify F05/F18 exposure using designated test identities. Enforce activation, verification, care access and privacy consistently (F06–F12); fix appointment concurrency and webhook settlement rules (F13–F15). Triage production dependency advisories (F45), deliver a forward schema migration, and get a clean reproducible production build. Disable simulated operational actions and misleading service claims until persistence exists.

### Next — this month

Complete verified claims, consent/access grants, doctor verification, password recovery and clinician assistant workflows. Implement durable pharmacy/staff/beds/refill/reminder behavior or formally narrow the product scope. Move chat/video to private membership-authorized realtime, test real two-party media and add TURN where needed. Fix canonical vital units, API error handling, action contrast, labels, dialogs and zoom; establish database/browser/authorization CI gates.

### Later

Optimize measured query/bundle bottlenecks, batch messaging queries and paginate clinical lists. Normalize medication scheduling/adherence and audit retention, expand locales and coherent themes, and perform full device/screen-reader review. Add deployment/restore drills, observability and provider reliability budgets. Define installability/offline requirements before implementing PWA caching, particularly for sensitive records.

## 9. Test gaps and first tests to write

Existing tests are valuable but not sufficient negative security tests. Node/API tests disable transform diagnostics; the app typecheck excludes tests. The loaded-module Node coverage run reports only 38.03% branch coverage; llm.ts had 6.97% lines and clinical-engine.ts 1.63% lines, and several high-risk routes were not loaded at all. The all-source coverage command failed, so no whole-project percentage is claimed.

| Priority | Tests | Required assertions |
| --- | --- | --- |
| 1 | Identity/claims | Unknown email plus victim phone cannot claim; OTP/token expiry/reuse/concurrent claims; Auth success plus DB failure compensates safely. |
| 1 | Role/status/target matrix | Anon/patient/verified doctor/unverified doctor/deactivated user/admin against every handler and server page; unrelated and cancelled-only relationships denied as designed. |
| 1 | RLS and column permissions in real disposable PostgreSQL/Supabase | Direct REST users.role/is_verified updates denied; AI tables isolated; revoked users and cancelled relationships obey the chosen policy. Test grants, not just RLS text. |
| 1 | Patient privacy across endpoints | Hidden medications/private notes absent from appointment, EHR, records, exports and clinician AI requests; patient/private-clinician distinction explicit. |
| 1 | AI outage/history | No invented normal labs; malformed provider results unavailable; last message reaches engine at 19/20/21/100 messages; newest urgent symptoms trigger emergency path in JSON and SSE modes. |
| 1 | Payment webhook | Invalid HMAC, replay, missing/unknown reference, wrong amount/currency/patient/appointment, terminal state and out-of-order failure; exactly-once side effects. |
| 1 | Scheduling | Two parallel overlapping requests, unequal durations, doctor/patient conflicts, past times, unverified/deactivated doctor and outside availability. Use actual DB transactions. |
| 2 | Fresh deployment | Empty database migrate deploy yields current columns/indexes/policies; clean npm ci/build/typecheck/lint; no hidden dashboard SQL dependency. |
| 2 | Browser journeys | Register/verify/login/logout/recover password, role routing, latest chat pagination, image unavailable, booking/payment return, record sharing and reload-after-save. |
| 2 | Request failures | 401/403/409/422/429/500, invalid JSON, offline/timeout and aborted responses preserve drafts and show correct status. |
| 2 | Accessibility/device | Accessible names, dialog focus, keyboard completion, contrast in every theme, 200–400% zoom, reduced motion, 320/390/768/1440px widths and touch controls. |
| 2 | Realtime/video | Unauthorized joins rejected; cannot forge sender/signaling; reconnect consistency; both join orders; camera denial; network loss; screen-share tracks end; real device pair. |
| 3 | Units/adherence/preferences | Fahrenheit/Celsius round-trip, glucose conversion, schedule frequency/start/end/PRN, timezone/DST, persistence across account/device changes and effective notification preferences. |
| 3 | Load/operability | Realistic large histories and many conversations, query counts/latency, connection pools, bundle budgets, LCP/CLS/INP, provider deadlines, delivery retries and backup restore. |

### Exact information/access needed to finish currently blocked validation

- A designated non-production Supabase project/isolated database and confirmation its contents are disposable; applied migration history, Data API exposed schemas/grants, RLS catalog, Storage bucket/policies, Realtime authorization/public-channel settings and publication configuration.
- Seeded test identities for patient A/B, verified doctor with/without relationship, pending doctor, deactivated user and admin, plus synthetic appointment/private-note/hidden-medication fixtures. Supply through an approved secret mechanism rather than including credentials in this report/chat.
- Paystack **test** account/keys, supported settlement currencies, configured webhook URL/events and a known test transaction/replay fixture; do not use live charges.
- AI provider test project with explicit budget/approved synthetic inputs and intended fallback/retention behavior. No real patient material is necessary for the first regression tests.
- Enough disk/memory for repeatable production build and full coverage, plus a working browser runner. Physical-device pair and browser/device targets are needed for real video/touch/accessibility sign-off.
- Product decisions: who may claim historical records, who approves access/doctor verification, what private means per audience, canonical clinical units, actual pharmacy/refill/staff/beds scope, supported notification channels, and whether offline/PWA behavior is required.

### Final validation notes

Build and compact dependency-summary completion are appended here after their final command results. No changes proposed in this report are authorized for implementation until the user selects them.

Which fixes would you like applied first?


## Fix log — batch 1, November 5, 2026

Branch: fix/audit-batch-1. No push, PR, hosted database access, seed, migration application, or real provider calls were performed. The original login, homepage, SidebarShell, middleware changes and Searches/ remain uncommitted and were not included in these commits. This report remains a working-tree artifact.

The batch stopped at the referral-acceptance product decision under the user's stop rule. **Batch 1 is incomplete.** F09 and subsequent work are queued, not represented as fixed.

| Finding | Files changed | Regression test added | Commit | Status |
| --- | --- | --- | --- | --- |
| F02 | src/lib/amelia/{llm,labvision}.ts; src/app/api/amelia/chat/route.ts; src/components/amelia/{LabPhotoUpload,AmeliaChat}.tsx; related tests | vision-unavailable.test.ts; unavailable parsing, JSON/SSE metadata, lab retry and chat notice tests | 8c26972 | Fixed for provider-unavailable fallback and status propagation. Image endpoint already serializes LabPhotoResult directly. No live provider/browser verification. |
| F03 | src/app/api/amelia/chat/route.ts; src/lib/amelia/{engine,types}.ts; chat/engine tests | 19/20/21/100-message JSON and SSE cases; raw emergency input independent of history | 947285d | Fixed. Recent window descending then reversed; raw submitted message independently screened in both engine paths. |
| F01 | src/app/api/auth/register/route.ts; src/__tests__/api/patient-records-lifecycle.test.ts | Reject provisional-email claim; no phone matching/binding; new record remains email-unverified | 00897ca | Fixed containment. Historical claiming removed; verified invitation/OTP claim and email verification delivery/callback flow still required. Existing email returns 409 because email is unique. |
| F06 | src/app/api/amelia/med-safety/route.ts; src/__tests__/api/amelia/med-safety-access.test.ts | Anonymous/inactive/other-patient/pending-doctor/unrelated-doctor denied before target read; authorized doctor allowed | 072fed9 | Fixed POST target access. Patient ID derives from identity; uses requireApiUser; own GET still awaits F09 status-hardening. |
| F07 | src/app/api/vitals/route.ts; src/__tests__/api/vitals-access.test.ts | No unscoped fallback, unrelated doctor denied before vitals query, patient target derived from identity | 833a44f | Fixed scoped-read defect. Shared activation/verification guard remains queued in F09. |
| F08 | src/app/api/{prescriptions,lab-tests,medications,referrals}/route.ts; src/app/api/patients/[id]/notes/route.ts; clinical-access.test.ts and authorized medication fixtures | Four-route unrelated-doctor matrix; existing authorized prescription tests now supply care relationship fixtures | fedd656 | Partially fixed. Creation paths require doctorHasPatientAccess. Central clinician role/status guard is still F09. Referral acceptance unchanged pending decision below. |
| F09 | None | None yet | — | Skipped at this checkpoint: batch stopped at F08 product decision. Activation/verification is not consistently enforced yet. |
| F12 | None | None yet | — | Not started after stop; appointment PATCH remains vulnerable. |
| F20 | None | None yet | — | Not started after stop; media policy unchanged. |
| F22 | None | None yet | — | Not started after stop; pharmacy parsing/fake orders unchanged. |
| F23 | None | None yet | — | Not started after stop; simulated bed/staff actions unchanged. |
| F31 | None | None yet | — | Not started after stop; submission error handling unchanged. |
| F44 | None | None yet | — | Not started after stop; lint script/config unchanged. |
| F28/F29/F30 quick wins | None | None yet | — | Not started after stop; login edits were preserved without further modification. |
| F04/F05/F13–F15/F17/F18/F21/F45 | None | None | — | Deferred explicitly by user; no fixes applied. |

### Verification per completed step

All tests used mocks; no configured hosted service was called by the new regression tests.

- F02: demonstrated three failing regressions before implementation. Initial npx tsc --noEmit failed on pre-existing corrupt generated .next/dev/types/validator.ts (a partial duplicate text fragment). Preserved it as .next/audit-corrupt-validator.txt; repeated npx tsc --noEmit passed. Full Node: 35 suites / 159 tests passed. Related UI: 2 suites / 11 tests passed. Initial failure is not counted as a pass.
- F03: boundary matrix and independent raw-input emergency tests failed before implementation; an initial ordering edit did not match CRLF text and the tests caught it. Corrected ordering, reran npx tsc --noEmit successfully, related tests 2 suites / 25 tests passed; full Node 35 suites / 169 tests passed.
- F01: claim tests failed before implementation, including a reproduced 201 binding on provisional email. npx tsc --noEmit passed; related lifecycle suite 10 tests passed; full Node 35 suites / 170 tests passed. Mock reset isolation was corrected so unused one-shot fixtures did not bleed into other lifecycle tests.
- F06: four unauthorized rows returned 200 before fix. npx tsc --noEmit passed; related suites 8 tests passed; full Node 36 suites / 176 tests passed.
- F07: baseline performed two patient queries and returned 200 to unrelated doctor target. npx tsc --noEmit passed; related suite 3 tests passed; full Node 37 suites / 179 tests passed.
- F08 creation paths: baseline reached target data/write paths instead of denying unrelated clinician. npx tsc --noEmit passed; related suites 12 tests passed; full Node 38 suites / 183 tests passed. Initial full run exposed two authorized-care fixtures that lacked a relationship; fixtures were made explicit and all checks repeated successfully.

Each full Node run used NODE_OPTIONS=--max-old-space-size=512 and --runInBand. Graphify AST updates completed after source changes. No lint pass or browser pass is claimed.

### Decision needed before completing F08

May a receiving doctor accept a pending referral when no existing care relationship exists, or must patient approval establish access first? The current doctorHasPatientAccess helper only recognizes qualifying appointments or already ACCEPTED referrals. Blindly requiring it before acceptance can make the first referral impossible to accept; adding a pending-referral exception would change the access policy. Neither exception nor redesigned consent flow was introduced. F04 remains deferred.

### Not verified

Hosted RLS/grants, real DB behavior, provider failure responses, actual email delivery/confirmation callbacks, browser rendering, mobile/device accessibility, real camera/video, migration compatibility and production deployment are unverified. All remaining batch work is explicitly queued above. The prior audit's second build compiled but failed typechecking the generated validator; that was not a successful production build. Its registry audit reported critical entries for next and handlebars plus high entries including zod/follow-redirects; dependency remediation remains deferred as requested.

### Recommended batch 2

First finish the queued batch-1 status/role guards and appointment PATCH restrictions; the remaining authorization gaps mean this branch is not ready for release. Then decide care/claim/consent policy (F04), close appointment-detail privacy bypass (F11), inspect/fix hosted grants and AI table RLS (F05/F18), and address atomic booking/payment settlement (F13–F15), schema drift (F17), vital units (F21) and advisory-specific dependency upgrades (F45). Do not apply these deferred changes without the user's decision.

## Fix log — batch 2, November 5–6, 2026 (local implementation complete; database verification pending)

Branch: `fix/audit-batch-2`. The user explicitly selected connected Supabase project `nypygbqncavvejmhrwbt` as authoritative for this batch. Local `.env` still points to `iwdoeotxfbhtjyxlzcgo`; plugin access to that project was denied. No credentials or environment settings were changed. The user also decided that each doctor's availability must use an explicitly configured IANA timezone; existing hours must not be guessed as UTC.

### Read-only Supabase inspection

All remote operations were project/catalog/advisor reads or aggregate counts. No application rows, patient content, credentials, DDL, migrations, seeds, provider calls or charges were read/executed. No available Supabase branch or second accessible dev project was found. Existing identities mean this project is **not confirmed disposable**; all migrations remain local and unapplied.

| Area | Observed in `nypygbqncavvejmhrwbt` |
| --- | --- |
| Migration history | Supabase migration list empty; no `_prisma_migrations` table. Auth/Realtime have their own internal migration tables, which are not application migration history. Local baseline is `20260717000000_baseline`; remote schema does not match it. Do not mark the baseline applied without reconciliation. |
| Tables / RLS | 17 public application tables, all with `relrowsecurity=false`. Four local Amelia-related tables (`amelia_conversations`, `amelia_messages`, `amelia_memories`, `reminders`) are absent remotely. No policies returned for public, storage or realtime. |
| Table privileges | Both `anon` and `authenticated` have SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER and TRUNCATE on all 17 public tables. RLS alone will not address TRUNCATE privileges. |
| Sensitive columns | `information_schema.column_privileges` shows INSERT/UPDATE/SELECT/REFERENCES for both roles on `users.role`, `users.is_active`, `doctors.is_verified`. Table-level UPDATE must be revoked before column-level UPDATE restrictions can be effective. |
| Schema drift | The three F17 prescription fields and all 34 missing schema index definitions are absent. Remote uses `payments.stripe_payment_id`, not local `paystack_reference`; `users.supabase_id` is text rather than local UUID; four Amelia tables absent. Remote has primary/unique indexes plus three audit indexes. |
| Data API | Security advisor reports public tables exposed through PostgREST with RLS disabled. No explicit `pgrst.db_schemas` value found in queried settings/role settings; full exposed-schema configuration remains unverified. |
| Storage | No buckets and zero stored objects; no Storage policies returned. |
| Realtime | No tables in the `supabase_realtime` publication and no Realtime policies returned. Public-channel/authorization service configuration is not exposed by the available plugin tools and remains unverified. |
| Auth | One Auth user. Email confirmation, SMTP credentials/provider configuration, and configured rate limits are not exposed by the available tools, so shared/default SMTP cannot be assumed. Advisor reports leaked-password protection disabled. |
| Counts only | Auth users 1; public users 1; doctors 1; patients 0; appointments 0; vitals 0; notes 0; prescriptions 0; lab orders 0; lab results 0; payments 0; messages 0; referrals 0; storage objects 0. Counts do not establish that this is a disposable environment. |

Before production, verify email confirmation is enabled and configure custom SMTP host, port, username, password through a secret mechanism, sender email and sender name; verify the sender domain's SPF/DKIM/DMARC and delivery. Set appropriate Auth email rate limits after configuring the provider. The default shared SMTP is unsuitable for general production delivery, but its use on this project has **not** been verified. Official reference: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Application-generated OTPs also need a configured delivery transport; Supabase Auth SMTP configuration alone does not deliver arbitrary application OTPs.

### Implementation status

| Finding | Files changed | Regression tests | Commit | Status |
| --- | --- | --- | --- | --- |
| F17 | `prisma/migrations/20261105000000_prescription_columns_and_indexes/migration.sql`; `scripts/verify-f17.sql`; migration contract test | Three offline contract tests failed first: 34 absent index definitions, three absent columns, and nullable doctor ID mismatch. | `7ed3af2` | Partially fixed: forward migration and SELECT-only verification written; baseline untouched. Preflight rejects out-of-band/equivalent objects instead of duplicating them. No migration application or fresh PostgreSQL verification; authoritative remote baseline/history mismatch must be reconciled first. |
| F13 | `prisma/schema.prisma`; timezone migration; `src/lib/appointment-availability.ts`; appointments POST; doctor availability PATCH; three test files | 11 invalid-booking regressions failed first; 20 related tests now cover doctor/patient status, future/integer/whole-minute times, IANA timezone, weekday/hours, closing boundary, DST and guarded self-configuration. | `59c1aea` | Fixed in local code; timezone migration unapplied. Existing doctors must configure their timezone/hours before bookings. Configuration API exists; settings UI remains a follow-up. |
| F14 | `src/lib/appointment-lock.ts`; appointments POST; overlap migration; `scripts/verify-f14.sql`; concurrency/validation tests | Parallel unequal-duration requests initially both returned 201. After fix, same doctor/different patients and different doctors/same patient yield one 201 and one 409; adjacent slots succeed. | `14ab60c` | Fixed application transaction path; database-wide exclusion constraints written but unapplied. Concurrency tests use a deterministic lock/transaction simulator; real PostgreSQL concurrency is unverified. |
| F16 | Decimal money in schema; durable PaymentAttempt; `payment-checkout.ts`, `money.ts`; initialization API and numeric JSON boundaries; fee validation; forward migration | Four checkout regressions failed first. Tests cover persist-before-provider ordering, stable retry reference, live-key rejection, missing quote, uncertain initialization, concurrent requests, exact cents and XOF rules. | `2abfb10` | Fixed in local code. Decimal/attempt migration unapplied. Uncertain initializations require reconciliation rather than blind retries. SMTP/payment tests made no real provider calls. |
| F15 | `payment-settlement.ts`; signed webhook route; event receipt/provider ID schema and forward migration | Nine security regressions failed first. Twelve settlement cases cover binding, signatures, replay/concurrency, cancelled appointments, unrelated events, rollback and reused provider IDs. | `0be809f` | Fixed local signed-success settlement path. Only `charge.success` settles payments; unrelated failure/transfer events are acknowledged without downgrading charges. Cancelled/terminal mismatches get a durable reconciliation outcome. Migrations and real provider/PostgreSQL verification remain unapplied/unverified. |
| F21 | Shared temperature conversion/threshold module; vitals schema/API; patient/doctor charts and displays; dashboard; records API; Amelia/risk/diagnosis context; migration and backfill plan | Three API pipeline cases failed first. Synthetic 98.6 F input stores 37 C with original 98.6/F, reads back, formats correctly and reaches AI as 37.0 C. A jsdom test verifies card/chart conversion and explicit-unit submission. | `efbd7b7` | Fixed local pipeline. Migration unapplied and deliberately refuses unknown legacy temperatures. The selected project has zero temperature readings; a reviewed nonempty-database plan is in `docs/migrations/temperature-backfill.md`. Browser/device and real database checks remain unverified. |
| F01 | Email OTP service/channel, provisional claim and verification APIs/forms, clinic invitation API, nullable unbound identity/contact fields, registration compensation, SMTP settings documentation and pinned Nodemailer dependencies | OTP/claim behavior and registration compensation regressions failed first; phone-only intake initially returned 422. | `15de8a8` | Fixed local verified claim/verification flow. Email OTP/invitation migration unapplied; real SMTP, Auth, proxy-header setup and PostgreSQL checks unverified. Original login edits remain untouched. |
| F04 | `prisma/schema.prisma`; `20261106000000_record_access_consent`; `record-{visibility,scope,access-requests}.ts`, `consent-api.ts`; auth/email transport; record-access APIs; intake/share APIs; patient/doctor access screens and navigation; `docs/record-access.md`, verification SQL | `intake-consent`, `record-visibility`, `record-consent`, `consent-role-matrix`, `record-consent-ui`; lifecycle/phone-only regressions. Actual intake baseline created a fake appointment and returned 201 instead of minimal pending status. | `54018df` | Fixed locally: directional source/scope approval, expiry/revoke, email proof, logs, request/status/approval UI and no automatic intake appointment. Migration unapplied; SMTP/real-identity/PostgreSQL/browser verification pending. Original provider retains authored records; revocation cannot recall already viewed/copied data. |
| F11 | `visible-patient-record.ts`, `record-visibility.ts`, `access-control.ts`; appointment/EHR/patient list/vitals/medications/prescriptions/labs/referrals/search/records reads; Amelia context/engine/prompts; risk context; doctor dashboard/monitoring/EHR | `appointment-visibility` reproduces eager full EHR loading and involved-doctor bypass; scoped policy tests cover source, direction, private/hidden records, scopes, expiry and revocation; context/temperature/lifecycle fixtures now model explicit ownership. | `f06d183` | Fixed local reads: self, authored records, or active source-scoped grants. Related medication-safety reads completed in F06. Missing profile/vitals are unavailable, not normal; provider reads logged. Real database enforcement/revocation concurrency and browser verification remain unverified. Collection-query load/performance is not measured. |
| F06 | `api/amelia/med-safety`, `lib/amelia/medsafety`, prescription hook and related tests | `med-safety-scoped` first reproduced inactive GET 200 and hidden prescription reads by doctors; existing anonymous/status/target matrix retained. | `ee310fa` | Fixed locally. Active/profile guard on GET; POST and post-prescription hook use visible data. Clinician results warn that unavailable history may contain additional risks. No real AI calls. |
| F07 | `api/vitals/route.ts`; `vital-mutation-matrix.test.ts` | Seven failing cases first: inactive/wrong-role writes, pending/inactive/unrelated clinicians, absent trusted authorship and blocked authorized clinician. | `e5f249e` | Fixed locally. Patients derive target from profile; verified clinicians need care access; authenticated authorship ignores forged fields. Appointment membership no longer broadcasts unapproved vital values to doctors. Scoped monitoring remains the provider read path. |
| F08 | `api/{prescriptions,medications,lab-tests,referrals}`; patient notes API; prescription-hook fixture | `clinician-mutation-matrix`: 19 baseline failures across five creation routes; final 30-case role/status/target/authorship matrix plus existing target tests. | `189ef3c` | Fixed locally. Guard before target data/write; author from authenticated clinician. New patient-entered medications retain user authorship; receiving provider must be active/verified. Referral arrival notification does not disclose clinical reason before approval. |
| F09 | `auth.ts`, `auth-cache.ts`, doctor layout/referral UI; referral PATCH; patient note/medication privacy, adherence/refill; clinical AI guards; appointment mutation guards and provider-of-record authorship | `clinical-status-followthrough` first failed 10 cases; `appointment-status-guard` first failed 2; server identity tests verify rejected sessions/status; additional booking regression first proved provider appointments were also tagged patient-entered. | `4562a4d` | Fixed local status/target guards. Conditional referral updates return 409 on race; acceptance never grants history access. Receiving doctor needs patient-approved care access before mutation. Provider appointment authorship cannot fall through a patient-entered-record grant. **F12 transition restrictions are separate and still pending from batch 1.** |
| F05 | `20261106010000_identity_column_privileges`; `scripts/verify-f05.sql`; `docs/migrations/security-verification.md` | Two offline `identity-grants` regressions failed before migration; read-only remote catalog checks show sensitive privileges are still present. | `9842a88` | Partially fixed: versioned SQL and verification written, **unapplied**. Revoke table and existing column privileges including PUBLIC; limited self-only name/avatar/bio updates, sensitive identity/role/status/verification fields server-only. Runtime SQL/RLS behavior requires an approved disposable DB. |
| F18 | `20261106020000_private_clinical_and_amelia_rls`; `scripts/verify-f18.sql`; `private-table-security.test.ts` | Two offline regressions failed first: every private schema table missing from protection and absent default-deny policy. Contract covers all 29 private application tables. | `99ba72d` | Partially fixed: RLS/default-deny and table/column privilege revocations written, **unapplied**. Existing unexpected policies or missing prerequisite tables abort for review. No alternate browser path bypasses application consent. Remote post-migration behavior is unverified. |

### Checks completed so far

- F17: related 3/3 tests pass; `npx tsc --noEmit` passes; full Node project 39 suites / 186 tests passes.
- F13: related 20/20 tests pass; `npx tsc --noEmit` passes; full Node project 42 suites / 206 tests passes.
- F14: related 15/15 tests pass; `npx tsc --noEmit` passes; full Node project 43 suites / 209 tests passes.
- F16: related 23/23 tests pass; `npx tsc --noEmit` passes; full Node project 45 suites / 222 tests passes.
- F15: related 25/25 tests pass; `npx tsc --noEmit` passes; full Node project 46 suites / 234 tests passes.
- F21: related Node 8/8 plus jsdom 1/1 pass; `npx tsc --noEmit` passes; full Node project 47 suites / 237 tests passes.
- The SELECT-only F17 index and column checks were run against the user-selected project: all 34 indexes and all three columns report MISSING. This verifies catalog-query syntax and absence, not successful DDL application. A separate read confirms zero non-null temperature readings.
- Every full Node run used `NODE_OPTIONS=--max-old-space-size=512` and `--runInBand`. Graphify AST updates completed. No real database, browser, SMTP delivery or provider integration pass is claimed.

No push or PR. Original login, homepage, SidebarShell, middleware and Searches/ edits remain outside the commits. This report remains an uncommitted working-tree artifact, as in batch 1.

### November 6 continuation

- F01 final checks: TypeScript passed; related Node 33 tests and jsdom 1 test passed; full Node 53 suites / 257 tests passed (512 MB, runInBand).
- F04: `54018df` adds scoped requests/grants/logs, immutable source/requester binding, safe known-author backfill, authenticated email re-verification, patient approval/revocation/log UI and doctor request/status UI. Intake matches now return only pending request ID/status, create no appointment, and preserve unsaved clinical drafts. Related 46 tests plus jsdom 1 passed; TypeScript and full Node 57 suites / 287 tests passed. Database migration remains unapplied. Integration with existing read surfaces is tracked separately under F11.
- F11: `f06d183`; related 44 tests, TypeScript and full Node 58 suites / 289 tests passed. Medication safety completed in F06. Clinical authorship/status follow-through completed in F07–F09.
- F06: related 11 tests, TypeScript and full Node 59 suites / 291 tests passed.
- F07: related 13 tests, TypeScript and full Node 60 suites / 298 tests passed.
- F08: related 42 tests, TypeScript and full Node 61 suites / 328 tests passed.
- F09: related 52 clinical/lifecycle/chat/lab tests and 17 focused status/identity tests passed. TypeScript and full Node 64 suites / 345 tests passed. Final provider-of-record regression failed first; after correction, related booking/policy 26 tests, TypeScript and full Node 66 suites / 350 tests passed. Correction was folded into F09; final hashes above supersede intermediate hashes mentioned in progress updates.
- F05: offline related 2 tests, TypeScript and full Node 65 suites / 347 tests passed.
- F18: offline related 4 tests, TypeScript and full Node 66 suites / 349 tests passed; final 350-test run also passed after the F09 authorship regression was added.
- Every full Node run used `NODE_OPTIONS=--max-old-space-size=512` and `--runInBand`. Graphify updates completed. No failed check is counted as a pass; fixture/typing issues found during intermediate runs were corrected and checks rerun.
- Nov 6 SELECT-only recheck: all 17 existing public tables still have RLS disabled, zero policies, anon TRUNCATE and authenticated table UPDATE. Sensitive-column privileges still include INSERT/UPDATE. First queries from the actual new verification scripts executed successfully: F05 reports all 16 role/column protection checks false; F18 reports 15 FAIL_RLS and 14 MISSING. This proves catalog-query syntax and current gaps, not successful migration execution.
- Final jsdom rerun: consent approval/revocation, email-proof form and temperature display suites all passed (3 suites / 3 tests). An initial invocation named a nonexistent temperature test file and failed; the corrected invocation above is the passing result. This is not browser/device verification.
- Original login, homepage, SidebarShell and middleware were SHA-256 checked after local history consolidation and remain byte-for-byte identical to their pre-operation contents. Searches/ stays untracked and untouched. No push or PR.

### Applied versus written; release boundary

**Applied to hosted databases: nothing.** No hosted DDL, migration, seed, insert,
update or delete ran. No real payment/AI/email calls ran. Fifteen commits on
`fix/audit-batch-2` contain the local Batch 2 implementation, one per finding.
The unchanged baseline and all forward migrations are local artifacts only.
Do not deploy the new application against the legacy 17-table schema: it needs
reconciliation and the new tables/columns first. `.env` still names the other
project; select the correct deployment project and supply secrets securely.

The 17-table authoritative project has existing identities and no available dev
branch; it is not confirmed disposable. Neither Docker nor psql is available
locally. Offline SQL contracts and SELECT-only catalog verification are **not**
a PostgreSQL migration/RLS/concurrency pass. `docs/migrations/security-verification.md`
describes the disposable-database rehearsal and baseline reconciliation boundary.

### Unverified items

- Actual DDL application, baseline/history reconciliation, fresh/legacy PostgreSQL
  migration chain, exclusion constraints, transactions/locks, claim compensation
  against real Auth, real-identity RLS/column access, and concurrent revocation.
- Auth confirmation settings, SMTP provider/shared-default status and service rate
  limits; Data API exposed-schema settings and Realtime public-channel settings
  were not exposed by the available tools. Do not assume they are configured.
- SMTP delivery, proxy-overwritten IP header, payment test integration/webhook
  delivery, actual AI responses, production build, browser/device rendering,
  accessibility and collection-query performance/load remain unverified. Tests
  used synthetic fixtures and mocks. No new lint pass is claimed (F44 is queued).

### Decision needed before database application

Designate or provide a disposable Supabase development project/branch reachable
through the plugin and approve migration/reconciliation testing there. The
connected existing project remains read-only. No further product-policy decision
is needed for these local fixes; the explicit directional consent, email-only
proof, Celsius and doctor-IANA-timezone decisions were implemented.

### Batch 3 recommendation

First address the outstanding **F12 appointment transition/race restrictions**;
F09 adds role/status guards but does not make patient status changes safe. The
branch is not release-ready while F12 and remote security/migration gaps remain.
Then finish queued batch-1 F20 media headers, F22/F23 fake actions and pharmacy
parsing, F31 failure/draft handling, F44 lint and F28–F30 accessibility. Add actual
browser/mobile UX review for the new consent/claim screens, clinic invitation
issuance UI and doctor timezone settings UI. Address F45 dependency advisories
with targeted upgrades and verification, and F19 private Realtime authorization
and revocation behavior before enabling realtime clinical data. Retest with
synthetic identities on the approved development database before any deployment.


## Fix log — batch 3, November 6–7, 2026 (in progress)

Branch `fix/audit-batch-3`, created from Batch 2 `99ba72d`. The user clarified
that the currently connected Nala Vita Supabase project is authoritative for
this and future work: plugin project `nalavita`, `nypygbqncavvejmhrwbt`. The pasted
`iwdoeotxfbhtjyxlzcgo` reference was denied by the plugin and superseded by that
explicit clarification. No environment credentials were changed.

Read-only reinspection: no application migration history, no dev branches,
17 public tables all with RLS disabled, zero realtime policies, Auth users 1,
public users 1, patients 0, appointments 0, Storage objects 0. Catalogs/counts
only; no patient data was read or printed. All hosted writes remain prohibited.
Earlier Batch 1 gaps (including F12 and absent F44 config) remain distinct from
completed local Batch 2 work; no prior log has been relabelled as complete.

Original login/homepage/SidebarShell/middleware bytes and original HEAD versions
were snapshotted under ignored `.next/audit-batch-3-original/` before edits.
The F10 middleware rewrite intentionally supersedes its unsafe cookie-only
session/metadata authorization, as explicitly required in Batch 3; the original
working file remains preserved in that snapshot. Other original edits stay out
of commits. Searches/ and this report remain untracked working artifacts.

| Finding | Files changed | Tests added | Commit | Status |
| --- | --- | --- | --- | --- |
| F10 | middleware; auth-cache; patient/doctor/admin layouts; patient dashboard boundary; remaining admin, patient-resource, settings, upload, billing, notifications and AI API guards; messaging identity checks | `role-layouts`, `middleware-identity`, `verified-boundaries`; verified identity test strengthened; existing resource fixtures now explicitly active. Seven regression cases failed before implementation. | `2ec2e19` | Fixed locally. Middleware uses verified getUser identity, preserves refresh cookies on redirects, and delegates authoritative roles/status to database-backed layouts/APIs. No server authorization reads cookie-derived getSession data or editable metadata. Related 29 tests, TypeScript and full Node 69 suites / 362 tests pass (512 MB/runInBand). Real Auth/cookie/browser verification pending. |

| F19 | Realtime event schemas and server publisher, appointment signal API, video panel, chat API and subscribers, TURN configuration, private Realtime migration and runbook | Forged broadcast appeared in the chat regression before implementation. Six Node tests cover participant binding, sender forgery, malformed and stale signals, transport failure, and TURN configuration. Five chat UI tests pass. | `e95c4c9` | Partially fixed. Local channel and server authorization changes pass TypeScript and 70 Node suites / 368 tests. SQL is unapplied. Live channel authorization, both join orders, and relay connectivity require a disposable project. |
| F20 | Next header rules and media policy regression | Consultation paths initially inherited the global denial. The config test verifies both route overrides. | `c252f56` | Fixed locally. TypeScript and 71 Node suites / 369 tests pass. Real camera and microphone behavior unverified. |
| F36 | Shared bounded body reader, file signatures, upload storage/quota helper, general and chat upload routes, Amelia image schemas, env example | Four baseline failures before the fix. Added streamed-size and invalid-image cases. Related 30 tests pass. | `95c4e7a` | Fixed locally. TypeScript and 72 Node suites / 377 tests pass. Default storage quota is 100 MiB per user across both endpoints. Failed cleanup emits a monitoring event and retains the reservation for reconciliation. Real Storage and concurrent PostgreSQL quota enforcement unverified. |

F10 intermediate syntax and incomplete active-user fixtures were caught by
TypeScript/tests, corrected, and all required checks rerun. Graphify updated.
No hosted DDL, migrations, seeds, writes, real AI/payment/email calls, push or PR.

### Batch 3 verification continued

| Finding | Files changed | Tests added | Commit | Status |
| --- | --- | --- | --- | --- |
| F37 | Request rate-limit helper, registration, OTP, TTS, env example | Registration and TTS regressions failed before the fix. Added neutral OTP throttling coverage. | `6118191` | Fixed locally. Related 17 tests, TypeScript and 73 Node suites / 380 tests passed. Upstash and trusted proxy deployment settings remain unverified. |
| F42 | Shared audit helper and audit call sites in Amelia and clinical routes | Two baseline regressions covered sanitization and structured failure logging. Related 42 tests passed. | `6844401` | Fixed locally. TypeScript and 72 Node suites / 380 tests passed. External ingestion and alert delivery remain unverified. |
| F35 | Provider deadline helper, Amelia and AI routes, Paystack client and checkout | Mocked SDK deadlines, cancellation and pending provider responses. Related 34 tests passed. | `db3d86e` | Fixed locally. TypeScript and 73 Node suites / 383 tests passed. Live provider behavior remains unverified. |

TypeScript exhausted the heap when it inherited Jest's 512 MB setting during F19 verification. It passed with its normal heap, and the Node Jest suite passed at 512 MB.
| F33 | Amelia LLM wrapper, reminder detection, memory extraction | `provider-model.test.ts` reproduced an OpenAI model being sent to Gemini. | `865a7f4` | Fixed locally. Each provider now uses its own existing default. Related 14 tests, TypeScript, and 74 Node suites / 384 tests passed. |
| F34 | Amelia LLM streaming, chat SSE route and chat UI | `stream-interruption.test.ts` reproduced fallback after partial output. The chat SSE test initially failed because the interruption arrived as a generic error. | `2977c14` | Fixed locally. Related 20 tests, TypeScript, and 75 Node suites / 385 tests passed. Partial output is retained and the client receives an interrupted event. |

| F45 | `package.json`, `package-lock.json` | Full and runtime audits before and after compatible remediation, then Prisma generation and regression suites. | `eb448c7` | Partially fixed. Runtime audit is clear. Full audit retains 27 development entries (4 low, 23 moderate) through Jest/ESLint. Next/config are 16.4.5, Prisma CLI/client/adapter are 7.10.1, Zod is 4.6.6. TypeScript, 36 focused tests and 75 Node suites / 392 tests passed. Breaking downgrades suggested by npm were left pending. |
| F26 | Doctor layout and role-layout regression | The regression confirmed the patient Amelia launcher appeared in the clinician layout. | `b088739` | Fixed locally. Launcher removed. A clinician assistant remains an outstanding feature. Focused 7 tests, TypeScript and 75 Node suites / 386 tests passed after dependency restoration. |


### F45 advisory reachability review

Audit snapshots were collected on November 7. The baseline full audit reported 31 package entries, including 2 critical and 9 high. The baseline runtime audit reported 10 entries, including 1 critical and 8 high. The compatible lockfile pass reports {'info': 0, 'low': 4, 'moderate': 23, 'high': 1, 'critical': 0, 'total': 28} for the full tree and {'info': 0, 'low': 0, 'moderate': 0, 'high': 0, 'critical': 0, 'total': 0} for runtime. Counts include transitive affected packages, so they differ from the unique advisory count below. Installed-tree validation remains pending.

| Package | Advisory | Reachability and action | Lockfile status |
| --- | --- | --- | --- |
| brace-expansion | [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Test/lint glob patterns. No application import. Compatible patches resolved the advisory. | Resolved in lockfile |
| brace-expansion | [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | Test/lint glob patterns. No application import. Compatible patches resolved the advisory. | Resolved in lockfile |
| brace-expansion | [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | Test/lint glob patterns. No application import. Compatible patches resolved the advisory. | Resolved in lockfile |
| deepmerge | [deepmerge mergeObject() allows prototype poisoning of returned objects](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | Jest configuration merge. Repository configuration is the input. Remaining development dependency. | Open |
| deepmerge-ts | [DeepmergeTS has stack exhaustion when merging recursive object graphs](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) | Prisma configuration/tooling. No application import. Patched through compatible Prisma alignment. | Resolved in lockfile |
| fast-uri | [fast-uri vulnerable to inconsistent host case normalization via percent-encoded octets](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | Prisma streams-local/Ajv URI parsing. No application import. Compatible transitive patch resolved. | Resolved in lockfile |
| fast-uri | [fast-uri vulnerable to URI scheme spoofing via percent-encoded scheme decoding](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) | Prisma streams-local/Ajv URI parsing. No application import. Compatible transitive patch resolved. | Resolved in lockfile |
| fast-uri | [fast-uri vulnerable to improper path equivalence in relative reference normalization](https://github.com/advisories/GHSA-xhq7-xmqj-769h) | Prisma streams-local/Ajv URI parsing. No application import. Compatible transitive patch resolved. | Resolved in lockfile |
| fast-uri | [fast-uri vulnerable to host confusion via unchecked WHATWG host canonicalization](https://github.com/advisories/GHSA-wjr9-j795-jxcr) | Prisma streams-local/Ajv URI parsing. No application import. Compatible transitive patch resolved. | Resolved in lockfile |
| fast-uri | [fast-uri vulnerable to scheme injection via an unescaped first-segment colon in suffix references](https://github.com/advisories/GHSA-333x-w4r6-6crp) | Prisma streams-local/Ajv URI parsing. No application import. Compatible transitive patch resolved. | Resolved in lockfile |
| follow-redirects | [follow-redirects array-form headers bypass cross-origin credential stripping](https://github.com/advisories/GHSA-q3jh-wrc6-jgq8) | Axios redirect implementation. No Axios imports found in src. Compatible transitive patch resolved. | Resolved in lockfile |
| follow-redirects | [follow-redirects sensitiveHeaders regex escaping can expose credential headers](https://github.com/advisories/GHSA-8r9p-f939-6h3c) | Axios redirect implementation. No Axios imports found in src. Compatible transitive patch resolved. | Resolved in lockfile |
| follow-redirects | [follow-redirects: Cross-realm sensitiveHeaders arrays are discarded and custom credentials can follow redirects](https://github.com/advisories/GHSA-mrwp-f3q8-3g9p) | Axios redirect implementation. No Axios imports found in src. Compatible transitive patch resolved. | Resolved in lockfile |
| glob | [Glob: AbortSignal cancellation bypass allows post-timeout filesystem traversal](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | Jest/reporters/coverage filesystem traversal. No application import. Remaining development dependency. | Open |
| handlebars | [Handlebars: JavaScript Injection via Unsafe Inline Embedding of Precompiled Templates](https://github.com/advisories/GHSA-xw65-4hp5-5hc7) | ts-jest dependency. Templates belong to test tooling. No app Handlebars imports. Compatible patch resolved. | Resolved in lockfile |
| handlebars | [Handlebars: JavaScript Injection via AST Type Confusion in compile (bypass of CVE-2026-33937)](https://github.com/advisories/GHSA-8r5x-fm3f-whwj) | ts-jest dependency. Templates belong to test tooling. No app Handlebars imports. Compatible patch resolved. | Resolved in lockfile |
| handlebars | [Handlebars: JavaScript Injection via Own Property Check Bypass](https://github.com/advisories/GHSA-p8wg-vrv2-v86f) | ts-jest dependency. Templates belong to test tooling. No app Handlebars imports. Compatible patch resolved. | Resolved in lockfile |
| minimatch | [minimatch has potential denial of service via globparts amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) | ESLint and Jest filesystem patterns. No application import. Remaining development dependency. | Open |
| mysql2 | [MySQL2: Auth Plugin Downgrade to mysql_clear_password Leaks Plaintext Credentials](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) | Prisma tooling dependency. App uses PostgreSQL adapter. No application MySQL imports. Compatible Prisma update resolved. | Resolved in lockfile |
| mysql2 | [MySQL2: Unbounded zlib inflate in compressed MySQL protocol handler allows decompression-bomb DoS](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) | Prisma tooling dependency. App uses PostgreSQL adapter. No application MySQL imports. Compatible Prisma update resolved. | Resolved in lockfile |
| next | [Next.js: Remote Code Execution in next/og ImageResponse](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js: Pending `use cache` fill can leak Draft Mode content into regular responses and persisted pages](https://github.com/advisories/GHSA-3w37-wq28-93x7) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js has cache poisoning of SSG and ISR pages in self-hosted applications](https://github.com/advisories/GHSA-4jqv-mc3x-m676) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js has information disclosure in development server's Model Context Protocol endpoint](https://github.com/advisories/GHSA-39w2-rjm5-chcv) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js has information disclosure in App Router metadata image routes via dynamicParams bypass](https://github.com/advisories/GHSA-f87g-xv8r-7p7x) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js has cache poisoning in SSG/ISR rendering that leads to cross-user content substitution and persistent denial of service](https://github.com/advisories/GHSA-mcj8-r9mp-w47p) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js has Server-Side Request Forgery in Image Optimization](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js: Unauthenticated Remote Code Execution in Image Optimization API when SVG files are used](https://github.com/advisories/GHSA-2464-fhr4-w9xw) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js: Denial of Service in App Router using Server Actions](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [next.js cache leak across root param values in nested 'use cache' functions](https://github.com/advisories/GHSA-h694-7cp9-m8p3) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| next | [Next.js: Unauthenticated Remote Code Execution in `use cache` functions returning typed arrays](https://github.com/advisories/GHSA-673q-mjm6-r5xr) | App Router and image optimization are framework runtime surfaces. No src references to next/og, Draft Mode, use cache or use server were found. Metadata/development paths depend on framework configuration. Compatible Next update resolved. | Resolved in lockfile |
| postcss-selector-parser | [PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Tailwind/PostCSS CSS build input. No application runtime import. Compatible transitive patch resolved. | Resolved in lockfile |
| sharp | [sharp : Vulnerability in librsvg dependency CVE-2026-96889](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | Next image processing is a potential runtime path. Native image dependency patched with compatible Next update. | Resolved in lockfile |
| source-map-js | [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | PostCSS/Next build source maps. No app import accepting submitted source maps. Compatible patch resolved. | Resolved in lockfile |
| zod | [Zod can exhaust memory while validating oversized constrained collections](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) | Reachable for untrusted API validation. Direct compatible update resolved. | Resolved in lockfile |

The residual glob/deepmerge/minimatch chains prompt npm to propose breaking downgrades of Jest or eslint-config-next. Those proposals were not applied. The exact proposals varied across registry snapshots, including Jest 29.7.0 or 25.1.0 and eslint-config-next 15.5.29. Approval would require a separate compatibility assessment. These remain relevant to running test/lint tooling on untrusted repository content. Brace-expansion also needs further compatible patch investigation.


| F53 | Medication analysis schema/cache and MedSafetyPanel | Seven backend regressions failed first. Added unavailable UI coverage, invalid structure cases, TTL and cache capacity tests. | `5a04f95` | Fixed locally. Related 17 Node tests, 4 UI tests, TypeScript and 75 Node suites / 392 tests passed. Invalid output and provider failure return unavailable, while exact allergy matches remain visible. Successful cache entries expire in five minutes, capacity is 128, and keys include a version and hashed patient/input scope. Live model calls remain unverified. |

The interrupted generated-file writes also left the doctor layout filled with zero bytes. It was reconstructed from committed content, then the intended launcher removal was reapplied. The other modified files had no NUL bytes. This recovery is included in the F26 checks.


F45 installed-tree verification completed after restoring dependencies. Prisma client generation, TypeScript, 36 focused Node tests and all 75 Node suites / 392 tests passed. Compatible security patches include brace-expansion 1.1.22 and glob 13.0.7. The final runtime audit reports zero vulnerabilities. The full audit's remaining development dependency entries are listed in the captured audit output. No breaking downgrade was applied. Earlier snapshot counts above are historical and do not describe the final lockfile.



| F32 | Reminder schedule and worker helpers, secret-protected scheduler route, notification listing, Amelia reminders/chat, profile settings, reminder UI, Prisma schema/migration, env example and worker runbook | Actual notification GET regression failed before the fix. Added worker authorization, concurrent claims and transactional rejection tests, DST/fractional timezone cases, legacy reminder notice and required profile timezone coverage. | `9a1b10a` | Partially fixed. TypeScript, 48 related Node tests, 3 UI tests and 77 Node suites / 402 tests passed. SQL is written only. Scheduler, real PostgreSQL transactions and deployment secrets remain unverified. Legacy reminders require explicit recreation. Daily scheduling skips nonexistent DST times and fires once on repeated local dates. Missed occurrences coalesce into one notification. |

| F40 | Medication adherence helper/API and patient/doctor medication displays | Endpoint regression reproduced 29% for a two-day twice-daily course with two daily entries. Added frequency, active course boundaries, PRN, unknown schedule, duplicate and future-start cases. | `487405f` | Partially fixed using the user-authorized minimum. TypeScript, 12 related tests and 79 Node suites / 407 tests passed. Denominators use frequency and intersect prescribed dates, duration/expiry, and the display window. Inactive courses lack a stop timestamp and are excluded. Unknown schedules and PRN have no rate. Legacy entries remain UTC day flags and are counted once per date. Full timezone-aware dose events and reliable historical stop dates remain outstanding. |
| F50 | Both manifests, robots.txt and role-layout metadata | Six failures reproduced missing manifest entries, obsolete sitemap reference and absent portal noindex. Existing PNG headers and dimensions are checked. | `7dc14d8` | Fixed locally. Reused the existing 192px and 512px PNG assets. Removed the obsolete sitemap reference. Related 13 tests, TypeScript and 80 Node suites / 413 tests passed. Browser indexing behavior remains unverified. |
| F43 | Homepage claim hunk, root metadata, settings, chat UI, Amelia notice/prompts | Ten content checks failed before the change. Updated the privacy-notice expectation. | `73adc95` | Fixed locally. TypeScript, 22 related Node tests, 12 UI tests and 81 Node suites / 423 tests passed. Unconditional compliance guarantees and hardcoded availability states were removed or labelled unavailable. Original homepage edits remain outside the commit. |

F43 legal review remains required for the Settings Medical Record Consent paragraph beginning “By using Nala Vita, you authorize certified healthcare providers…” and for published consent, privacy and retention terms. No regulatory certification has been established by these code checks.


### F44 remaining lint violations

The flat Next 16 config runs through npm run lint. It exits 1 with 96 errors and 81 warnings. Archived Amelia sources and generated Vercel/build/graph outputs are excluded, matching their repository status. CommonJS Jest setup files retain their required import syntax. No source rule was disabled.

| Severity | Rule | Count |
| --- | --- | --- |
| Error | @typescript-eslint/no-explicit-any | 56 |
| Error | react-hooks/set-state-in-effect | 40 |
| Warning | @next/next/no-img-element | 1 |
| Warning | @next/next/no-location-assign-relative-destination | 1 |
| Warning | @typescript-eslint/no-unused-vars | 74 |
| Warning | None | 1 |
| Warning | react-hooks/exhaustive-deps | 3 |
| Warning | react-hooks/incompatible-library | 1 |

| File and line | Severity | Rule | Message |
| --- | --- | --- | --- |
| `src/__tests__/api/amelia/chat.test.ts:202` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/amelia/chat.test.ts:202` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:4` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:10` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:18` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:19` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:25` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:26` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:29` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:32` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:39` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/payment-settlement.test.ts:51` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/api/temperature-pipeline.test.ts:1` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/components/record-consent-ui.test.tsx:6` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/components/record-consent-ui.test.tsx:6` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/amelia/context.test.ts:4` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/amelia/medsafety-newrx.test.ts:1` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:3` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:4` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:5` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:5` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:10` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:11` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:13` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:14` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:15` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:16` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:17` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:18` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:23` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-otp.test.ts:27` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-verification.test.ts:2` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-verification.test.ts:6` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/email-verification.test.ts:6` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/middleware-identity.test.ts:2` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/patient-claim.test.ts:2` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/patient-claim.test.ts:2` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/patient-claim.test.ts:9` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/patient-claim.test.ts:10` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-consent.test.ts:2` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-consent.test.ts:2` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-consent.test.ts:3` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-consent.test.ts:5` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-consent.test.ts:11` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-consent.test.ts:12` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-consent.test.ts:16` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-visibility.test.ts:12` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-visibility.test.ts:12` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-visibility.test.ts:13` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/__tests__/lib/record-visibility.test.ts:13` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/app/(admin)/admin/reports/page.tsx:229` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(admin)/admin/settings/page.tsx:21` | Warning | @typescript-eslint/no-unused-vars | 'Server' is defined but never used. |
| `src/app/(admin)/admin/settings/page.tsx:61` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(admin)/admin/staff/page.tsx:105` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(auth)/register/page.tsx:118` | Warning | react-hooks/incompatible-library | Compilation Skipped: Use of incompatible library |
| `src/app/(doctor)/doctor/appointments/page.tsx:112` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(doctor)/doctor/billing/page.tsx:51` | Warning | @typescript-eslint/no-unused-vars | 'setPayouts' is assigned a value but never used. |
| `src/app/(doctor)/doctor/consultation/[appointmentId]/page.tsx:23` | Warning | @typescript-eslint/no-unused-vars | 'Wand2' is defined but never used. |
| `src/app/(doctor)/doctor/consultation/[appointmentId]/page.tsx:183` | Warning | @typescript-eslint/no-unused-vars | 'displayAppointment' is assigned a value but never used. |
| `src/app/(doctor)/doctor/dashboard/page.tsx:7` | Warning | @typescript-eslint/no-unused-vars | 'getAuthenticatedUserWithProfile' is defined but never used. |
| `src/app/(doctor)/doctor/lab-orders/page.tsx:74` | Warning | @typescript-eslint/no-unused-vars | 'loadingPatients' is assigned a value but never used. |
| `src/app/(doctor)/doctor/lab-orders/page.tsx:121` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(doctor)/doctor/monitoring/page.tsx:19` | Warning | @typescript-eslint/no-unused-vars | 'subDays' is defined but never used. |
| `src/app/(doctor)/doctor/monitoring/page.tsx:169` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(doctor)/doctor/patients/[id]/page.tsx:26` | Warning | @typescript-eslint/no-unused-vars | '_Clock' is defined but never used. |
| `src/app/(doctor)/doctor/patients/[id]/page.tsx:217` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(doctor)/doctor/patients/page.tsx:118` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(doctor)/doctor/patients/page.tsx:390` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(doctor)/doctor/prescriptions/page.tsx:21` | Warning | @typescript-eslint/no-unused-vars | 'Sparkles' is defined but never used. |
| `src/app/(doctor)/doctor/prescriptions/page.tsx:22` | Warning | @typescript-eslint/no-unused-vars | 'TrendingUp' is defined but never used. |
| `src/app/(doctor)/doctor/prescriptions/page.tsx:207` | Warning | react-hooks/exhaustive-deps | React Hook useEffect has a missing dependency: 'selectedPatient'. Either include it or remove the dependency array. |
| `src/app/(doctor)/doctor/prescriptions/page.tsx:237` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(doctor)/doctor/referrals/page.tsx:92` | Warning | @typescript-eslint/no-unused-vars | 'loadingData' is assigned a value but never used. |
| `src/app/(doctor)/doctor/referrals/page.tsx:167` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/appointments/page.tsx:119` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/appointments/page.tsx:149` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/appointments/page.tsx:381` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/lab-results/page.tsx:87` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/medications/page.tsx:231` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/mental-health/page.tsx:162` | Warning | @typescript-eslint/no-unused-vars | '_seconds' is assigned a value but never used. |
| `src/app/(patient)/patient/mental-health/page.tsx:167` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/mental-health/page.tsx:277` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/payments/page.tsx:98` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/pharmacy/page.tsx:76` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/prescriptions/page.tsx:72` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/records/page.tsx:30` | Warning | @typescript-eslint/no-unused-vars | 'UserPlus' is defined but never used. |
| `src/app/(patient)/patient/records/page.tsx:1112` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/(patient)/patient/vitals/page.tsx:210` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/app/api/admin/reports/route.ts:10` | Warning | @typescript-eslint/no-unused-vars | 'user' is assigned a value but never used. |
| `src/app/api/admin/staff/route.ts:5` | Warning | @typescript-eslint/no-unused-vars | '_req' is defined but never used. |
| `src/app/api/admin/staff/route.ts:9` | Warning | @typescript-eslint/no-unused-vars | 'user' is assigned a value but never used. |
| `src/app/api/admin/staff/route.ts:51` | Warning | @typescript-eslint/no-unused-vars | 'user' is assigned a value but never used. |
| `src/app/api/ai/diagnosis-support/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/ai/diagnosis-support/route.ts:7` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/ai/diagnosis-support/route.ts:166` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/app/api/ai/lab-photo/route.ts:7` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/ai/lab-photo/route.ts:8` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/ai/lab-summary/route.ts:5` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/ai/lab-summary/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/ai/risk-score/route.ts:8` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/ai/risk-score/route.ts:9` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/ai/risk-score/route.ts:128` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/app/api/ai/soap-format/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/ai/soap-format/route.ts:24` | Warning | @typescript-eslint/no-unused-vars | 'user' is assigned a value but never used. |
| `src/app/api/ai/symptom-check/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/ai/symptom-check/route.ts:95` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/app/api/amelia/chat/route.ts:7` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/amelia/conversations/[id]/route.ts:3` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/amelia/med-safety/route.ts:5` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/amelia/med-safety/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/amelia/med-safety/route.ts:10` | Warning | @typescript-eslint/no-unused-vars | '_req' is defined but never used. |
| `src/app/api/amelia/memory/[id]/route.ts:4` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/amelia/memory/route.ts:5` | Warning | @typescript-eslint/no-unused-vars | '_req' is defined but never used. |
| `src/app/api/amelia/reminders/[id]/route.ts:3` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/amelia/reminders/route.ts:5` | Warning | @typescript-eslint/no-unused-vars | 'prisma' is defined but never used. |
| `src/app/api/appointments/[id]/route.ts:7` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/appointments/route.ts:5` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/lab-tests/route.ts:8` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/medications/[id]/privacy/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/medications/[id]/refill/route.ts:4` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/medications/[id]/usage/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/medications/route.ts:9` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/mental-health/route.ts:11` | Warning | @typescript-eslint/no-unused-vars | '_req' is defined but never used. |
| `src/app/api/patients/[id]/notes/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/patients/privacy/route.ts:6` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/patients/route.ts:7` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/payments/route.ts:10` | Warning | @typescript-eslint/no-unused-vars | '_req' is defined but never used. |
| `src/app/api/prescriptions/route.ts:7` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/records/route.ts:5` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/records/route.ts:7` | Warning | @typescript-eslint/no-unused-vars | '_req' is defined but never used. |
| `src/app/api/referrals/route.ts:7` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/referrals/route.ts:125` | Warning | @typescript-eslint/no-unused-vars | '_req' is defined but never used. |
| `src/app/api/search/route.ts:4` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/app/api/vitals/route.ts:8` | Warning | @typescript-eslint/no-unused-vars | 'createServerSupabaseClient' is defined but never used. |
| `src/components/amelia/AmeliaChat.tsx:203` | Warning | None | Unused eslint-disable directive (no problems were reported from 'no-constant-condition'). |
| `src/components/amelia/AmeliaConversationList.tsx:60` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/amelia/AmeliaLauncher.tsx:8` | Warning | @typescript-eslint/no-unused-vars | 'PanelRightClose' is defined but never used. |
| `src/components/amelia/AmeliaLauncher.tsx:10` | Warning | @typescript-eslint/no-unused-vars | 'Maximize2' is defined but never used. |
| `src/components/amelia/AmeliaLauncher.tsx:12` | Warning | @typescript-eslint/no-unused-vars | 'Stethoscope' is defined but never used. |
| `src/components/amelia/AmeliaLauncher.tsx:13` | Warning | @typescript-eslint/no-unused-vars | 'Activity' is defined but never used. |
| `src/components/amelia/AmeliaLauncher.tsx:14` | Warning | @typescript-eslint/no-unused-vars | 'Pill' is defined but never used. |
| `src/components/amelia/AmeliaLauncher.tsx:15` | Warning | @typescript-eslint/no-unused-vars | 'FileQuestion' is defined but never used. |
| `src/components/amelia/AmeliaLauncher.tsx:26` | Warning | @typescript-eslint/no-unused-vars | 'setChatKey' is assigned a value but never used. |
| `src/components/amelia/AmeliaMemoryPanel.tsx:38` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/amelia/AmeliaRemindersPanel.tsx:30` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/auth/EmailProofForm.tsx:12` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/chat/ChatWindow.tsx:111` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/common/RouteProgress.tsx:15` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/common/RouteProgress.tsx:22` | Warning | react-hooks/exhaustive-deps | React Hook useEffect has a missing dependency: 'isNavigating'. Either include it or remove the dependency array. |
| `src/components/layout/SidebarShell.tsx:54` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/medications/AddMedicationModal.tsx:40` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/notifications/NotificationBell.tsx:68` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/notifications/NotificationBell.tsx:293` | Warning | @next/next/no-location-assign-relative-destination | Do not use `window.location.href` to navigate to internal Next.js pages. Use `redirect()` in the render phase, or `useRouter().push()` in Client Components' event handlers instead. See: https://nextjs.org/docs/messages/no-location-assign-relative-destination |
| `src/components/records/DoctorRecordRequests.tsx:20` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/records/PatientRecordAccess.tsx:12` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/records/PatientRecordAccess.tsx:73` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/settings/SettingsPanel.tsx:31` | Warning | @typescript-eslint/no-unused-vars | 'CheckCircle2' is defined but never used. |
| `src/components/settings/SettingsPanel.tsx:32` | Warning | @typescript-eslint/no-unused-vars | 'RefreshCw' is defined but never used. |
| `src/components/settings/SettingsPanel.tsx:176` | Warning | @typescript-eslint/no-unused-vars | 'loadingProfile' is assigned a value but never used. |
| `src/components/settings/SettingsPanel.tsx:197` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/ui/CommandPalette.tsx:13` | Warning | @typescript-eslint/no-unused-vars | 'FileText' is defined but never used. |
| `src/components/ui/CommandPalette.tsx:14` | Warning | @typescript-eslint/no-unused-vars | 'CreditCard' is defined but never used. |
| `src/components/ui/CommandPalette.tsx:15` | Warning | @typescript-eslint/no-unused-vars | 'Settings' is defined but never used. |
| `src/components/ui/CommandPalette.tsx:18` | Warning | @typescript-eslint/no-unused-vars | 'Command' is defined but never used. |
| `src/components/ui/CommandPalette.tsx:21` | Warning | @typescript-eslint/no-unused-vars | 'Video' is defined but never used. |
| `src/components/ui/CommandPalette.tsx:39` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/components/ui/CommandPalette.tsx:53` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/ui/CommandPalette.tsx:151` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/ui/CommandPalette.tsx:162` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/components/ui/CommandPalette.tsx:198` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/components/ui/avatar.tsx:22` | Warning | @next/next/no-img-element | Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` or a custom image loader to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element |
| `src/hooks/useRealtimeMessages.ts:68` | Warning | react-hooks/exhaustive-deps | React Hook useCallback has a missing dependency: 'options'. Either include it or remove the dependency array. |
| `src/hooks/useRealtimeMessages.ts:74` | Error | react-hooks/set-state-in-effect | Error: Calling setState synchronously within an effect can trigger cascading renders |
| `src/lib/gemini.ts:43` | Error | @typescript-eslint/no-explicit-any | Unexpected any. Specify a different type. |
| `src/lib/otp-channel.ts:22` | Warning | @typescript-eslint/no-unused-vars | '_recipient' is defined but never used. |
| `src/lib/otp-channel.ts:22` | Warning | @typescript-eslint/no-unused-vars | '_code' is defined but never used. |
| `src/lib/otp-channel.ts:22` | Warning | @typescript-eslint/no-unused-vars | '_purpose' is defined but never used. |

| F44 | Flat ESLint config, lint script, escaped JSX text, payment/notification navigation, video handler declaration order | The original lint command failed because Next 16 interpreted lint as a directory. Ran the replacement across source, tests and configuration. | `d18a147` | Partially fixed. Lint executes and reports 96 errors / 81 warnings, listed above. Safe corrections passed TypeScript, 49 focused Node tests and 81 Node suites / 423 tests. The lint command still exits 1 because the listed violations remain. |

### F46 test diagnostics and CI

Node ts-jest diagnostics are enabled. The inherited isolatedModules setting means these transform diagnostics do not replace a semantic typecheck of test sources. A separate TypeScript check with tsconfig.test.json exited 2 with 421 semantic errors in 55 files. Production TypeScript passed. The common failures are untyped Jest mocks inferred as never, incomplete model fixtures, mocked request contexts and Jest mock compatibility. These are not counted as passing type validation.

| TypeScript diagnostic | Count |
| --- | --- |
| TS1117 | 1 |
| TS2322 | 18 |
| TS2339 | 148 |
| TS2345 | 241 |
| TS2353 | 2 |
| TS2451 | 6 |
| TS2554 | 1 |
| TS2737 | 4 |

| Test source | Diagnostic counts |
| --- | --- |
| `src/__tests__/api/ai/tts.test.ts` | TS2345 × 4 |
| `src/__tests__/api/amelia/chat.test.ts` | TS2345 × 37 |
| `src/__tests__/api/amelia/lab-photo.test.ts` | TS2345 × 6 |
| `src/__tests__/api/amelia/lab-summary.test.ts` | TS2345 × 4 |
| `src/__tests__/api/amelia/med-safety.test.ts` | TS2345 × 4 |
| `src/__tests__/api/amelia/memory.test.ts` | TS2345 × 16 |
| `src/__tests__/api/amelia/notifications-fire.test.ts` | TS2345 × 9 |
| `src/__tests__/api/amelia/prescriptions-hook.test.ts` | TS2345 × 5 |
| `src/__tests__/api/amelia/reminders.test.ts` | TS2345 × 13, TS2554 × 1 |
| `src/__tests__/api/medication-pipeline.test.ts` | TS2345 × 37 |
| `src/__tests__/api/patient-records-lifecycle.test.ts` | TS1117 × 1, TS2345 × 45, TS2353 × 2 |
| `src/__tests__/api/payment-initialization.test.ts` | TS2737 × 1 |
| `src/__tests__/api/payment-settlement.test.ts` | TS2737 × 1 |
| `src/__tests__/api/private-signaling.test.ts` | TS2345 × 3 |
| `src/__tests__/components/AddMedicationModal.test.tsx` | TS2322 × 4, TS2339 × 3 |
| `src/__tests__/components/ChatInput.test.tsx` | TS2322 × 5, TS2339 × 4 |
| `src/__tests__/components/ChatMessage.test.tsx` | TS2339 × 4 |
| `src/__tests__/components/EmptyState.test.tsx` | TS2339 × 3 |
| `src/__tests__/components/HealthDashboard.test.tsx` | TS2322 × 3, TS2339 × 5 |
| `src/__tests__/components/MedicationSchedule.test.tsx` | TS2339 × 6 |
| `src/__tests__/components/MetricCard.test.tsx` | TS2339 × 6 |
| `src/__tests__/components/PageHeader.test.tsx` | TS2339 × 3 |
| `src/__tests__/components/PatientIntakeChart.test.tsx` | TS2339 × 2 |
| `src/__tests__/components/SectionCard.test.tsx` | TS2339 × 3 |
| `src/__tests__/components/SidebarShell.test.tsx` | TS2339 × 5, TS2345 × 1 |
| `src/__tests__/components/ThemeSwitcher.test.tsx` | TS2339 × 7 |
| `src/__tests__/components/amelia/AmeliaChat-reminder.test.tsx` | TS2339 × 1 |
| `src/__tests__/components/amelia/AmeliaChat.test.tsx` | TS2339 × 13 |
| `src/__tests__/components/amelia/AmeliaConversationList.test.tsx` | TS2339 × 25 |
| `src/__tests__/components/amelia/AmeliaLauncher.test.tsx` | TS2339 × 2 |
| `src/__tests__/components/amelia/AmeliaMemoryPanel.test.tsx` | TS2322 × 1, TS2339 × 4 |
| `src/__tests__/components/amelia/AmeliaRemindersPanel.test.tsx` | TS2322 × 1, TS2339 × 3 |
| `src/__tests__/components/amelia/AmeliaTabs.test.tsx` | TS2339 × 4 |
| `src/__tests__/components/amelia/LabPhotoUpload.test.tsx` | TS2339 × 7 |
| `src/__tests__/components/amelia/MedSafetyPanel.test.tsx` | TS2339 × 7 |
| `src/__tests__/components/amelia/ReminderCard.test.tsx` | TS2339 × 5 |
| `src/__tests__/components/chat/ChatWindow-attachments.test.tsx` | TS2339 × 7 |
| `src/__tests__/components/email-proof-form.test.tsx` | TS2339 × 5 |
| `src/__tests__/components/record-consent-ui.test.tsx` | TS2339 × 7 |
| `src/__tests__/components/temperature-display.test.tsx` | TS2339 × 2 |
| `src/__tests__/lib/amelia/context.test.ts` | TS2345 × 3 |
| `src/__tests__/lib/amelia/conversations.test.ts` | TS2345 × 7 |
| `src/__tests__/lib/amelia/engine.test.ts` | TS2345 × 7 |
| `src/__tests__/lib/amelia/labvision.test.ts` | TS2322 × 1, TS2345 × 4 |
| `src/__tests__/lib/amelia/medsafety-analyze.test.ts` | TS2322 × 1, TS2345 × 7 |
| `src/__tests__/lib/amelia/medsafety-newrx.test.ts` | TS2345 × 5 |
| `src/__tests__/lib/amelia/memory-crud.test.ts` | TS2345 × 3 |
| `src/__tests__/lib/amelia/memory-extract.test.ts` | TS2322 × 1, TS2345 × 3 |
| `src/__tests__/lib/amelia/memory-store.test.ts` | TS2345 × 4 |
| `src/__tests__/lib/amelia/reminders-crud.test.ts` | TS2345 × 4 |
| `src/__tests__/lib/amelia/reminders-detect.test.ts` | TS2322 × 1, TS2345 × 3 |
| `src/__tests__/lib/email-otp.test.ts` | TS2451 × 3 |
| `src/__tests__/lib/money.test.ts` | TS2737 × 2 |
| `src/__tests__/lib/patient-claim.test.ts` | TS2339 × 5, TS2345 × 7, TS2451 × 2 |
| `src/__tests__/lib/record-visibility.test.ts` | TS2451 × 1 |

The GitHub Actions workflow has separate application checks and fresh-migration jobs. It uses synthetic provider settings and a dedicated PostgreSQL 17 service at 127.0.0.1. Minimal Auth/Realtime catalog stubs let application SQL compile on bare Postgres. Those stubs do not verify managed Supabase behavior. Docker and psql are unavailable locally, so no disposable migration run was performed. The workflow YAML parses locally. GitHub execution requires a later push by the user. Existing lint violations keep that gate red. The contrast step will use the F27 contrast command.

F46 safe test-type corrections set the Node test target to ES2022, isolate test modules, remove a duplicated fixture key and correct a zero-argument GET call. The repeated semantic check still exits 2 with 419 errors. Production TypeScript, 84 related tests and 82 Node suites / 424 tests pass.
- TS2322 remains at 18 occurrences.
- TS2339 remains at 148 occurrences.
- TS2345 remains at 241 occurrences.
- TS2353 remains at 2 occurrences.
- TS2451 remains at 6 occurrences.
- TS2737 remains at 4 occurrences.

## Fix log checkpoint — November 12

Batch 3 remains incomplete. This checkpoint records completed local work and the outstanding implementation separately.

| Finding | Files changed | Tests | Commit | Status |
| --- | --- | --- | --- | --- |
| F46 | Jest config/test tsconfig, CI workflow, disposable SQL stubs and corrected fixtures | Production TypeScript, 84 related tests and 424 Node tests passed. Semantic test check still had 419 errors. | c7acbb7 | Partially fixed. CI execution and fresh migration run unverified. |
| F27 | Global action tokens, shared button, contrast script and package command | Initial contrast failures reproduced. 60 action/state pairs, related UI tests, TypeScript and 424 Node tests passed. | 8b0fe7d | Fixed locally. Browser appearance unverified. |
| F48 | Appearance stylesheet, theme provider/switcher, brand hook, root layout and expanded contrast script | Two palette regressions failed first. Five palette UI tests and 108 contrast pairs passed. Production TypeScript and the subsequent full Node run passed. | 6249adb | Fixed locally. Existing light/dark preference is retained. Legacy palette-only choices migrate to independent brand storage and system brightness. Browser coverage pending. |
| Account recovery | Recovery request/update/callback routes, proof helper, two pages/form, tests and setup guide | Seven API tests, two UI tests, TypeScript and full Node run passed. | 58619ed | Fixed locally. Existing login and Settings links now resolve. SMTP, templates, redirect allowlists and live recovery remain unverified. |
| F51 | Typed fetch helper, verified identity endpoint, query provider and hooks, notification handling and logout hunk | Missing helper and absent auth-cache clearing reproduced. Three helper tests, seven related UI tests, TypeScript and 434 Node tests passed. | 03122b6 | Fixed locally. User keys derive from server-verified identity. Original SidebarShell changes remain outside the commit. |
| F31 | Staff/vitals submission handlers and UI regression | Both regressions failed first. Both UI tests, TypeScript and 434 Node tests passed. | 93f262c | Fixed locally. Staff state updates after server confirmation. Failed vital submissions retain the draft and display the server error. |
| F25 | Private verification table/migration, admin read/review APIs, mandatory transactional audit option, pending-doctor layout/cache/dashboard changes and regressions | Regression failures observed. Final verification pending at checkpoint. | Uncommitted | Partially implemented. Admin review UI and complete workflow verification remain unfinished. SQL unapplied. |
| F47 | README, CLAUDE Next 16 correction and OpenAI env example | Documentation drafted. | Uncommitted | Partially implemented. Health/readiness endpoints and final runbook verification remain unfinished. |

### Outstanding implementation

F38/F39 pagination and messaging batching, durable refill requests and doctor decisions, F25 admin UI, F28/F29/F30/F52 dialog/sidebar/form accessibility and reduced motion, F24/F41 dashboard/settings/daily-vitals behavior, F49 translation coverage and route-scoped catalogs, and F47 health/readiness still require work. Browser screenshots at all requested widths have not been attempted. No visual sign-off is claimed.

### Verification limits and decisions

The full lint command executes but retains the listed violations. Semantic test-source checking fails and is reported above. The most recent completed full Node run before the unfinished F25 edits passed 434 tests. Live Auth, Realtime, TURN, Storage, provider delivery, scheduler deployment, migrations, CI and browser behavior remain unverified. No hosted writes, migration application, seeds, real provider calls, push or PR were performed.

No new product decision is required for the unfinished local work identified here. Remaining breaking dependency downgrades require a separate compatibility decision. Legal review is required for the retained consent wording and published privacy/retention terms.

### SQL order and deployment

Apply migration directories in lexical timestamp order only after legacy baseline reconciliation and verification in an approved disposable database. Batch 3 adds private Realtime, reminder scheduling, and the unfinished doctor-verification migration after the earlier Batch 2 migrations. All remain unapplied by the agent.

### Pre-launch checklist

- Configure custom SMTP, recovery email templates and redirect allowlists.
- Configure TURN and verify media across separate networks.
- Configure and verify Paystack live credentials and callbacks.
- Complete consent/privacy/compliance legal review.
- Run and verify a restore drill.
- Complete a penetration test.
- Complete the outstanding implementation, lint/type cleanup, disposable migration checks and browser verification before release.
The final F25 validation command was interrupted before producing a result. It is not counted as a pass. F25 and F47 remain uncommitted working drafts.

## Batch 3 continuation — November 12

F25 completed in commit a4d3bf6. Files include the private verification migration/schema, mandatory transactional audit support, admin review APIs/UI and navigation, pending-doctor boundaries, contract registration and scripts/verify-f18.sql. The existing composite index was normalized to the migration contract's canonical quoted syntax. Table and column privileges are explicitly revoked, RLS is enabled with no permissive policy, and future table grants are revoked.

The original contract assertions remain intact. The contract now includes the F25 private-table migration alongside F18, respecting migration order instead of making the earlier migration reference a table that does not yet exist. No SQL was applied.

The one added lint error was react-hooks/globals in src/__tests__/components/QueryAuthScope.test.tsx. Capturing the query client moved from render into an effect.

After F25, production npx tsc --noEmit passed at its default heap. Lint exits 1 with 96 errors and 81 warnings. Related Node checks passed 18 tests. Admin review/cache UI checks passed 3 tests. The full Node project passed 85 suites and 441 tests at 512 MB with runInBand. An intermediate run failed only the old five-item admin navigation count; its expectation now explicitly includes the sixth doctor-verification route. That failed run was not counted as a pass.

F25 email delivery is tested with synthetic mocks. Live SMTP, the private migration, actual PostgreSQL transaction rollback, and browser behavior remain unverified.

| F47 | README, CLAUDE, env example, health/ready routes and operations tests | Missing endpoint regression, DB-independent liveness, reachable DB and redacted readiness failure | 0bf7fcb | Fixed locally. Production TypeScript and 86 Node suites / 444 tests passed. Readiness bounds its response wait to three seconds; the underlying Prisma probe has no AbortSignal cancellation support. Real DB readiness and deployment remain unverified. |
| F12 | Appointment PATCH/DELETE and transition/webhook tests | 74 role/state cases including notes and a lost race; cancelled/completed webhook reconciliation | 5745531 | Fixed locally. The regression initially failed 67 cases. Production TypeScript, 87 related tests and 87 Node suites / 519 tests passed. Patients can cancel only SCHEDULED/CONFIRMED appointments. Clinicians can start scheduled/confirmed appointments, mark those NO_SHOW, complete IN_PROGRESS, and edit notes. Terminal states cannot reopen. Conditional predicates include current status and updatedAt. SQL/provider infrastructure was mocked. |

| F22 | Pharmacy page; PharmacyEnvelope.test.tsx | API medications envelope regression failed then passed; production tsc and full Node 87 suites/519 tests passed | `13ba557` | fixed locally |
| F23 | Pharmacy, beds, staff pages; UnavailableActions.test.tsx | Three disabled-action regressions failed first; six related UI tests passed; production tsc and full Node 87 suites/519 tests passed | `908e75e` | fixed locally; no real inventory/order integration claimed. Graphify refresh failed parsing generated graph JSON (line 15327); source checks passed. |

| F38 | Shared pagination; notifications, vitals, payments, Amelia conversations; pagination/access tests | Three endpoint regressions failed first; 26 related tests, production tsc, full Node 89 suites/532 tests passed | `ac4e8db` | bounded cursor queries fixed locally; clinician workspace still loads each bounded patient record separately. |
| F39 | Messages route; message-conversations helper; message-query-count tests | 1/10/50 partner regressions showed 4/22/102 queries before; one query after. Four related tests, production tsc, full Node 90 suites/536 tests passed | `0ea7e80` | locally verified mocked query-count and parameterization; PostgreSQL execution/EXPLAIN and live membership not verified. |

Continuation lint: exit 1, 96 errors / 80 warnings. Graphify update succeeded on retry. No hosted data read or written.

| Refill lifecycle (requested follow-up) | RefillRequest schema/unapplied migration; patient request route; review/list routes; shared patient/clinician panel; private-table verification | Initial durable/duplicate tests failed; 17 related Node tests and 2 UI tests passed; production tsc passed; full Node 93 suites/548 tests passed | `6d0365b` | fixed locally, database migration and SMTP/dispensing unverified. Approval records clinical review only; it does not assert dispensing or consume a dispensed refill. SQL default-deny and one-pending index are contract-tested, not applied. |

| F29 | AccessibleDialog primitive, Modal, mobile SidebarShell; ModalAccessibility and SidebarShell tests | Named dialog regression failed first; 13 UI tests cover focus/trap/inert/Escape/restore/nesting; production tsc and full Node 93 suites/548 tests passed | `d1785ef` | locally fixed, browser keyboard/assistive technology unverified; original sidebar edits remain unstaged. New hook-order lint regression was corrected; existing sidebar set-state-in-effect remains. |

| F28 | Login/register forms; SettingsPanel; AuthFieldAccessibility and SettingsFieldAccessibility tests | Missing labels reproduced first; three UI tests pass including validation associations/draft retention, production tsc and full Node 93 suites/548 tests passed | `ed6523a` | locally fixed; original login edits remain unstaged; browser screen-reader verification outstanding. Lint 96 errors/79 warnings. |

| F30 | Root viewport; viewport.test.ts | Imported viewport regression failed with maximumScale=1, then passed; production tsc and full Node 94 suites/549 tests passed | `7e2fe3f` | zoom constraint removed; actual browser zoom/reflow outstanding. |

| F52 | AmeliaLauncher, ChatWindow, VideoCallPanel, communication route viewport classes, ThemeProvider, CSS, motion helper and two tests | Reduced-motion launcher regression failed first; 8 related UI tests passed; production tsc and full Node 94 suites/549 tests passed | `5684267` | motion/dvh/wrapping changes verified locally; requested browser widths, zoom and touch checks remain unverified. |

| F24 | Admin dashboard and doctor analytics; SampleReporting.test.tsx | Sample-reporting tests failed first then 2 passed; production tsc and full Node 94 suites/549 tests passed | `e1c51c9` | sample previews explicitly labelled, artificial spinners removed; no live aggregate reporting claimed. |
| F41 | Daily snapshot schema/unapplied migration, vitals API, daily tracker wrapper, SettingsPanel, patient dashboard; API/UI/private-table contracts | Initial API and unsupported-setting regressions failed; 8 related UI tests and 13 related Node tests passed; production tsc and full Node 95 suites/554 tests passed | `e636c46` | fixed locally; DB persistence unverified without migration. Unsupported units/notification settings disabled. Daily checkbox is self-report, not a dose/dispensing record. |

F49 continuation checkpoint (November 14): catalog root-scoping and navigation regressions failed before implementation, then 15 related UI tests plus 5 catalog/scoping tests passed. Production tsc passed; full Node 96 suites/559 tests passed. Lint remains exit 1, 96 errors/79 warnings. Root serializes common/nav only; auth and settings have scoped providers. Auth forms/validation and built-in navigation use all five catalogs. **Partially fixed:** other screens and fixed-locale date formatting still need localization; translations need native-speaker review. Original login/sidebar changes remain unstaged.

| F13 timezone UI follow-through | Availability API GET, doctor settings and onboarding picker, public doctor timezone, booking summary/local-date helper; API/UI/date tests | Missing settings UI reproduced first; 10 related UI tests and 15 related Node tests passed; production tsc and full Node 98 suites/566 tests passed | `0752807` | fixed locally; browser and real booking/DB unverified. Local date parsing now preserves the selected calendar date; invalid/nonexistent local clock times are rejected. New unused test import removed after lint reported 96 errors/80 warnings. |
| F49 continuation | Scoped providers, five catalogs, auth forms and nav; catalog/nav/auth tests | 15 UI and 5 catalog tests, production tsc and full Node 96 suites/559 tests passed | `9ba11bf` | partially fixed; remaining English screens/date formatting and native-speaker review outstanding. |

| F01 invitation issuance UI follow-through | ClinicInvitation, clinician patient page, invitation eligibility GET/no-store responses; API/UI tests | New feature test initially failed for absent UI; 2 UI and 10 API/claim tests passed; production tsc and full Node 99 suites/569 tests passed | `68a0d5f` | fixed locally; invitation is displayed only after an action, never auto-emailed, and kept in component memory. Live OTP/claim/SMTP not exercised. |

Additional pre-launch gap confirmed during F44 typing review: `api/ai/symptom-check`, `api/ai/risk-score`, and `api/ai/diagnosis-support` still fabricate clinical fallback assessments on provider failure (including a fixed low risk score of 24). The original F02 lab-fallback fix does not cover these endpoints. They must return an explicit unavailable result with endpoint/UI regression coverage before production. The typing cleanup preserves existing behavior and does not claim to fix this gap.

### November 15 quality continuation

| Finding | Files | Verification | Commit | Status |
|---|---|---|---|---|
| F46 | Typed mock/projection/fixture/request helpers; Jest matcher declarations; affected API/UI/library test fixtures; TURN environment input type; CI semantic test gate | Semantic check initially failed with 483 errors, then 255/240/201/120/10, finally 0 (`npx tsc --noEmit -p tsconfig.test.json`). Production tsc passed with default heap. Full Node at 512 MB: 99 suites/569 tests passed. Full jsdom: 46 suites/138 tests passed. CI YAML parsed; workflow not executed. | `9f39ef9` | Fixed locally; CI result unverified until user push. No diagnostics were suppressed or tests loosened. Replaced an obsolete reminder-function spy with the actual worker export. |

F44 remains in progress and uncommitted. Last measured intermediate lint result: exit 1, 80 errors / 68 warnings; subsequent typed-mock changes also remove some lint findings, so this is not a final count. Production build, browser screenshots, remaining English copy/date formatting, full F01–F53 repro replay, migration reconciliation and final sign-off remain outstanding.


### F44 completion — 2026-11-15

| Finding | Files changed | Regression / verification | Commit | Status |
|---|---|---|---|---|
| F44 | Typed API/library test fixtures; clinician/patient/admin data loaders; keyed chat and patient views; local preference hook and its consumers; RouteProgress; unused imports and bindings in API/UI modules. Exact file inventory: `.next/batch3-final/f44-stage-list.json` plus SidebarShell, useLocalPreference and the five new component test files. | LocalPreference (stored value and same-window updates), CommandPalette (stale response/reopen), AmeliaCollectionFailures (HTTP failures, observed red then green), RealtimeMessageIsolation (old thread visible during partner switch, observed red then green), RouteProgress (late animation timers cannot revive completed progress). Existing assertions retained in typed tests. | a7b2368 | **Fixed**: `npm run lint` exits 0, **0 errors / 2 warnings**. No rule disabled and no blanket suppression. Remaining warnings are register React Hook Form `watch` compiler compatibility (`react-hooks/incompatible-library`) and avatar raw image performance (`@next/next/no-img-element`). |

Final F44 working-tree gates, observed exit 0: production `npx tsc --noEmit` with default heap; `npx tsc --noEmit -p tsconfig.test.json` (**0 semantic errors**); lint; full Node project with `NODE_OPTIONS=--max-old-space-size=512 --runInBand` (**99 suites / 569 tests**); full jsdom project (**49 suites / 142 tests**). Logs: `.next/batch3-final/f44-final-{tsc,test-types,lint,node,ui}.txt`. Intermediate typechecks caught a duplicate vitals import and incomplete adherence refresh references, then unused-parameter signature changes in test call sites; those failures were corrected and are not counted as passes. Modified tracked source files were scanned for empty/NUL content: none found. Original login/homepage edits and Sidebar logout edits remain unstaged. No external provider calls or hosted writes were made.

This completes F44, not the entire Batch 3 request. Remaining verification includes production build, browser widths/zoom, final contrast rerun, CI inventory/YAML verification, and the full F01–F53 evidence table. F49 remains partial. The previously recorded fabricated clinician AI fallback gap remains open and must be resolved before launch.


### Batch 3 quality verification — 2026-11-15

- `npm run build` with synthetic provider credentials, localhost-only dummy DB/Supabase endpoints, no migrations and default heap: compiled successfully. See `coverage/audit-preserved/build-final.txt` (final process exit recorded separately below). Next reports pre-existing React 18 and middleware-convention deprecations, and an outside-repository `bun.lock` warning. No dependency upgrade or middleware rename was attempted.
- `npm run test:contrast`: exit 0; **108 theme/state pairs** checked. This is token-pair verification, not a screenshot contrast audit.
- `.github/workflows/ci.yml` parsed with PyYAML; required `npm ci`, production/test semantic tsc, lint, both Jest projects, contrast, build, and disposable Postgres17 migration bootstrap/deploy/status steps exist. GitHub CI and the disposable DB job have not been executed locally and are not claimed to pass.
- Browser verification attempted via browser computer-use and Windows fallback initialization. Both failed before launch with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. Consequently **no screenshots or visual claims** at 320/390/768/1440, zoom, touch, protected dashboards, booking, consent or recovery.
- Next cleaned `.next` during the build. Audit evidence and the original user-edit backups were copied before building to **`coverage/audit-preserved/batch3-final/`** and **`coverage/audit-preserved/audit-batch-3-original/`**. Prior `.next/batch3-final/...` log references resolve to these preserved copies. These are ignored local artifacts.


### F02 clinical assessment follow-through — 2026-11-15

| Finding | Files changed | Regression | Commit | Status |
|---|---|---|---|---|
| F02 follow-through | `src/lib/clinical-ai-response.ts`; `api/ai/{symptom-check,risk-score,diagnosis-support}/route.ts`; patient symptom-checker page; `clinical-ai-unavailable.test.ts`, `SymptomAssessmentUnavailable.test.tsx` | 18 API regressions first failed: missing key, provider rejection, empty text, invalid JSON and wrong-shaped JSON for each endpoint; schema-valid responses retained. All 18 pass after fix. UI regression first failed for missing error announcement, then passed; 503 leaves the description and selections available for retry. | 6fd2a99 | Fixed locally: removed invented urgency, condition/test/treatment recommendations and fixed low risk score. Failure is HTTP503 `{status:"unavailable",error:...}` without clinical values. Successful model output must validate against the endpoint schema and has `status:"available"`. Existing provider timeout handling remains. |

Production default-heap typecheck, semantic test typecheck (0 errors), lint (0 errors / 2 existing warnings), related API (18) and UI (1) tests passed. Full Node with 512MB/runInBand: **100 suites / 587 tests passed**. Full jsdom rerun is recorded below when complete. Only mocked providers were used. The prior successful production build predates this follow-through and is not evidence for the new source; a fresh build is queued. The earlier documented clinical AI fallback gap is now resolved in local code, with live clinical/provider validation still unverified. The test's first UI attempt selected two textboxes ambiguously; it was corrected before observing the intended missing-alert failure.

Browser tool retry after the host update also timed out during initialization. Screenshots remain unavailable. The earlier build process completed with **exit 0**.


## Batch 3 verification ledger — November 15, 2026

This ledger supersedes historical checkpoint statuses above. **The batch is not fully complete: F49 translation/date coverage remains partial.** “Fixed (local)” means the authorized local implementation and regression checks pass; it does not mean deployed or tested against real services. All PostgreSQL/SMTP/Paystack/Realtime/TURN/provider checks remain unverified unless explicitly described as mocked. The report and original user edits remain uncommitted by design.

The full Node run (100 suites / 587 tests) and jsdom run (50 suites / 143 tests) replay the section 4 cases through committed real-module regression tests with synthetic identities and mocked integrations. The original ad-hoc VM harness was not retained; these are equivalent committed probes, not live attacks. No production identities or rows were read. For findings originally based only on source review, the evidence below states the specific contract or UI test instead of claiming a browser reproduction.

| ID | Current status | Main implementation / evidence replayed | Commit(s) | Infrastructure or remaining limitation |
|---|---|---|---|---|
| F01 | Fixed (local) | register/claim/OTP/invitation APIs and forms; `patient-records-lifecycle`, `patient-claim`, `email-otp`, `email-verification`, `clinic-invitation`, ClinicInvitation UI | `00897ca`, `15de8a8`, `68a0d5f` | OTP/identity migration unapplied; real Auth, invitation claim and SMTP delivery unverified. |
| F02 | Fixed (local) | Amelia llm/labvision/chat and LabPhotoUpload; `vision-unavailable`, `lab-photo`, chat status tests; clinical AI endpoint schemas and `clinical-ai-unavailable`, `SymptomAssessmentUnavailable` | `8c26972`, `6fd2a99` | No live image/model validation; missing/error/empty/malformed/wrong-shape responses fail visibly. |
| F03 | Fixed (local) | Amelia chat/engine latest descending window then reverse; JSON/SSE 19/20/21/100-message cases in `api/amelia/chat`, raw red flags in `lib/amelia/engine` | `947285d` | Mocked history/provider; no real SSE proxy test. |
| F04 | Fixed (local) | consent APIs, intake, source-scoped visibility and approval screens; `intake-consent`, `consent-role-matrix`, `record-consent`, `record-consent-ui` | `54018df` | Consent migration/real revoke concurrency and SMTP unverified; legal approval still required. |
| F05 | Partially fixed | identity column privilege migration and verify-f05.sql; `identity-grants` | `9842a88` | SQL unapplied. Previously inspected connected project still had broad browser privileges; no claim of deployed containment. |
| F06 | Fixed (local) | med-safety scoped read/write paths and prescription hook; `med-safety-access`, `med-safety-scoped`, `med-safety`, `prescriptions-hook` | `072fed9`, `ee310fa` | Real provider/DB unverified; unavailable history is explicitly limited. |
| F07 | Fixed (local) | vitals self-target/clinician care checks; `vitals-access`, `vital-mutation-matrix` | `833a44f`, `e5f249e` | No real database policy test; no unscoped fallback. |
| F08 | Fixed (local) | clinical mutation guards/authorship; `clinical-access`, `clinician-mutation-matrix`, `clinical-status-followthrough` | `fedd656`, `189ef3c`, `4562a4d` | Referral acceptance requires approved care access; arrival is not a history grant. |
| F09 | Fixed (local) | central API/layout status guards and authenticated authorship; `clinical-status-followthrough`, `appointment-status-guard`, `role-layouts` | `4562a4d`, `2ec2e19` | Runtime Auth/session revocation with real infrastructure unverified. |
| F10 | Fixed (local) | auth/cache/middleware/layouts use verified identity plus DB role/status; `server-identity`, `middleware-identity`, `verified-boundaries` | `2ec2e19` | Tampered fixtures are not a real forged-cookie penetration test. |
| F11 | Fixed (local) | visible-patient-record/record-visibility across appointment/EHR reads; `appointment-visibility`, `record-visibility`, `context` | `f06d183` | Real DB enforcement/revocation concurrency unverified. |
| F12 | Fixed (local) | appointment PATCH/DELETE role/transition/CAS and terminal webhook behavior; `appointment-transitions`, `appointment-status-guard`, `payment-settlement` | `5745531` | Conditional-update race tests mocked; real transactions unverified. |
| F13 | Partially fixed | booking locks/exclusion migration plus timezone setup; `appointment-concurrency`, `appointment-overlap`, `doctor-availability`, `booking-time` | `14ab60c`, `0752807` | Original F13 was concurrency; historical Batch 2 F13/F14 commit labels were swapped. Global exclusion constraints unapplied; no real Postgres race test. |
| F14 | Fixed (local) | authoritative IANA availability, whole-minute/future/integer booking validation; `appointment-validation`, `appointment-availability`, doctor timezone API/UI tests | `59c1aea`, `0752807` | Existing hours require each doctor's actual timezone before booking; DB migration unapplied. |
| F15 | Fixed (local) | signed exact-bound, idempotent settlement and guarded terminal states; `payment-settlement` | `0be809f`, `5745531` | Provider-event migration and real Paystack/Postgres replay unverified. |
| F16 | Fixed (local) | durable checkout attempts/Decimal money; `payment-initialization`, `money` | `2abfb10` | Migration unapplied; real provider uncertain-attempt reconciliation unverified. |
| F17 | Partially fixed | forward prescription/index migration and verify-f17.sql; `migration-contract` (also F25 index additions) | `7ed3af2`, `a4d3bf6` | Fresh DB job not run; connected legacy schema remains unreconciled. |
| F18 | Partially fixed | default-deny RLS/table+column revocations; private table registration including verification/refill/daily tracking; `private-table-security` | `99ba72d`, `a4d3bf6`, `6d0365b`, `e636c46` | All security SQL unapplied; live catalog/role isolation must be checked in an approved disposable DB. |
| F19 | Partially fixed | private chat/video relay and membership policies; `private-signaling`, ChatWindow forged-event tests, `RealtimeMessageIsolation` | `e95c4c9`, `a7b2368` | Realtime migration/configuration and cross-user join/relay tests unverified. |
| F20 | Fixed (local) | route-specific next.config.mjs permissions; `consultation-media-policy` | `c252f56` | No physical camera/mic or browser header verification. |
| F21 | Fixed (local) | canonical temperature conversion/API/chart/context; `temperature-pipeline`, medication/vital UI checks | `efbd7b7` | Migration unapplied; never infer units for unknown legacy readings. |
| F22 | Fixed (local) | pharmacy medications envelope; `PharmacyEnvelope` | `13ba557` | No real dispensing/order integration claimed. |
| F23 | Fixed (local) | disabled fake pharmacy/bed/staff actions and sample labels; `UnavailableActions` | `908e75e` | Persisted order/bed/staff creation intentionally unavailable. |
| F24 | Fixed (local) | explicit sample admin/doctor analytics, no fake waits; `SampleReporting` | `e1c51c9` | No real operational metrics represented by sample cards. |
| F25 | Fixed (local) | verification migration/admin review/pending state/transactional audit/email; `admin/doctor-verification`, DoctorVerificationQueue UI, migration/private-table contracts | `a4d3bf6` | SQL unapplied; SMTP and actual rollback unverified. |
| F26 | Fixed (local) | patient assistant removed from doctor layout; role-layout test | `b088739` | No clinician assistant product substituted. |
| F27 | Partially fixed | action tokens/shared button; contrast script 108 theme/state pairs | `8b0fe7d`, `6249adb` | Real inherited/hover/focus/disabled screen contrast unverified without browser. |
| F28 | Fixed (local) | auth/settings label IDs, error associations and names; `AuthFieldAccessibility`, SettingsFieldAccessibility; symptom error announcement | `ed6523a`, `6fd2a99` | Screen-reader/device walkthrough unverified. |
| F29 | Fixed (local) | AccessibleDialog, modal/mobile Sidebar; focus/escape/inert/restore tests | `d1785ef` | Browser keyboard/touch verification unavailable. |
| F30 | Fixed (local) | root viewport; `viewport` | `7e2fe3f` | User zoom/reflow at 200–400% unverified. |
| F31 | Fixed (local) | staff/vital response.ok and retained drafts; `FailedSubmissions` | `93f262c` | Live server error/browser behavior unverified. |
| F32 | Partially fixed | timezone reminder schedule/atomic worker/internal secret endpoint; `reminder-schedule`, `reminder-worker`, `internal/reminders` | `9a1b10a` | Migration/cron deployment unverified. Legacy reminders without a known timezone remain excluded pending review. |
| F33 | Fixed (local) | provider model defaults; `provider-model` | `865a7f4` | Model availability not tested with a paid request. |
| F34 | Fixed (local) | stream interruption handling; `stream-interruption` | `2977c14` | Real proxy/network streaming unverified. |
| F35 | Fixed (local) | provider-deadline and AI/Paystack cancellation; `provider-cancellation` and timeout regressions | `db3d86e` | SDK/network abort behavior unverified with real integrations; readiness cannot cancel its underlying Prisma query. |
| F36 | Fixed (local) | bounded upload/quota/content validation/cleanup; `upload-boundaries`, chat attachments | `95c4e7a` | Storage bucket policies, cleanup and concurrency unverified live. |
| F37 | Partially fixed | trusted IP limits, authenticated TTS/signup/OTP boundaries; `rate-limit`, `rate-limited-boundaries`, `ai/tts` | `6118191` | Shared Redis/proxy configuration and distributed enforcement must be deployed and verified. |
| F38 | Fixed (local) | shared bounded keyset pagination; `pagination`, `pagination-contract` | `ac4e8db` | Clinician workspace still loads each bounded patient record separately. |
| F39 | Partially fixed | one parameterized conversation aggregate; `message-query-count` at 1/10/50 partners | `0ea7e80` | Mocked query count is one; SQL execution, EXPLAIN/index plan and live membership unverified. |
| F40 | Partially fixed | frequency/course-window adherence estimator; `medication-adherence` | `487405f` | Estimates labelled, PRN excluded; full scheduled dose events/patient-timezone lifecycle remain open. |
| F41 | Fixed (local) | daily snapshot API/wrapper and disabled unsupported settings; `daily-vitals`, PersistedDailyVitals, settings UI | `e636c46` | Snapshot migration unapplied. Checkbox is self-report, not a dispensing/dose record. |
| F42 | Partially fixed | minimized audit helper/failed-write visibility; mandatory verification audit transaction; `audit`, doctor-verification tests | `6844401`, `a4d3bf6` | Complete mutation/outbox coverage, retention/access policy and operational alerting not verified. |
| F43 | Fixed (local) | removal of unsupported compliance/live/online claims; `product-claims` | `73adc95` | Legal/privacy/retention approval still needed before making new assurances. |
| F44 | Fixed (local) | ESLint flat config and hook/type cleanup; `npm run lint` exit0, 0 errors/2 warnings; LocalPreference, CommandPalette, AmeliaCollectionFailures, RealtimeMessageIsolation, RouteProgress | `d18a147`, `a7b2368` | Compatibility warning in register and avatar image performance warning remain documented. |
| F45 | Partially fixed | compatible package/lock upgrades and Prisma generation | `eb448c7` | Last Nov11 registry snapshot: runtime0, full27 development advisories (4low/23moderate). Not freshly re-audited on Nov15; no force/downgrade. |
| F46 | Partially fixed overall; typing complete | Jest diagnostics, typed helpers, CI semantic gate; test tsc0; Node100/587, jsdom50/143 | `c7acbb7`, `9f39ef9` | CI, disposable DB/RLS/integration and browser journeys not run. Local mocked tests are not a release sign-off. |
| F47 | Fixed (local) | README/env/CLAUDE, health/ready APIs; `operations/health`; successful build before F02 follow-through | `0bf7fcb` | Real DB readiness/deployment and fresh CI run unverified; updated build result below. |
| F48 | Partially fixed | independent brand/brightness and adapted surfaces; `themes`, ThemeSwitcher, 108 contrast pairs | `6249adb` | Complete rendered theme coverage not verified; browser unavailable. |
| F49 | Partially fixed | scoped root/auth/settings messages; auth/nav translation in en/fr/ha/ig/yo, `message-catalogs` key/placeholder parity, auth/nav UI tests | `9ba11bf` | Other product screens and fixed-English date formats remain untranslated. Native-speaker review needed; parity does not prove translation coverage/quality. |
| F50 | Fixed (local) | manifests/icons/private metadata; `search-metadata` | `7dc14d8` | Installability/canonical deployment/browser verification unperformed; no PHI/offline service worker added. |
| F51 | Fixed (local) | verified identity keys/auth cache clearing/fetchJson failures; `api-fetch`, QueryAuthScope; thread isolation regression | `03122b6`, `a7b2368` | Real auth switch/revocation/browser unverified; original Sidebar logout edits remain separate. |
| F52 | Partially fixed | reduced-motion helpers/MotionConfig, dvh layouts, wrapping video controls; reduced-motion/component tests | `5684267` | Browser failed initialization; 320/390/768/1440, zoom and actual touch/motion comfort remain unverified. |
| F53 | Fixed (local) | medication-safety response validation, explicit unavailable, versioned bounded TTL cache; `medsafety-analyze`, `medsafety-newrx`, `medsafety-pure` | `5a04f95` | Real clinical/provider output validation unverified. |

Additional required features: durable refill review (`6d0365b`, refill lifecycle/list/decision API tests plus UI), doctor timezone picker and booking summary (`0752807`), clinic invitation issuance (`68a0d5f`), and verified password recovery (`58619ed`) are implemented locally. Refill approval is a review decision, not medication dispensing or automatic refill-count advancement. Recovery live SMTP/templates/redirects/session invalidation require integration verification.

### Written migration sequence — none applied

Apply only to a reviewed schema after reconciliation; this list is the lexical order, not permission to execute against the connected project:

1. `20260717000000_baseline`
2. `20261105000000_prescription_columns_and_indexes`
3. `20261105010000_doctor_availability_timezone`
4. `20261105020000_appointment_overlap_constraints`
5. `20261105030000_payment_attempts_and_decimal_money`
6. `20261105040000_payment_event_idempotency`
7. `20261105050000_canonical_celsius`
8. `20261105060000_email_otp_and_verified_claims`
9. `20261106000000_record_access_consent`
10. `20261106010000_identity_column_privileges`
11. `20261106020000_private_clinical_and_amelia_rls`
12. `20261106030000_private_realtime`
13. `20261111000000_reminder_schedule`
14. `20261111010000_doctor_verification`
15. `20261113000000_refill_requests`
16. `20261113010000_daily_vital_snapshots`

The authoritative connected project is `nypygbqncavvejmhrwbt` (nalavita), read-only. The prior catalog inspection found a legacy 17-table schema with no application migration history, text Supabase IDs, legacy Stripe payment columns, missing Amelia tables/indexes and broad browser grants with no RLS. Existing identity means it is not disposable. Do not mark the baseline applied or run the forward chain there. First take/restore a backup into an approved isolated environment, reconcile schema-only identity/payment/table/index drift and migration history, then rehearse the chain with synthetic identities and role isolation. Reconcile duplicate/overlapping bookings, exact legacy money and payment references, proven legacy temperature units, clinical record provenance/visibility, and known doctor/reminder timezones before enabling dependent features. Unknown provenance/timezone/units must not be guessed. Read-only verification scripts are catalog checks, not proof of row access or transaction behavior. CI's fresh Postgres catalog stubs do not emulate managed Auth/Realtime/Storage services.

### Verified / unverified and outstanding work

Verified locally: production typecheck, semantic test typecheck, zero lint errors, mocked negative authorization/transition/outage/replay/concurrency contracts, component interactions, contrast token pairs, workflow YAML/step inventory, and the production build before the final AI follow-through. Current full suites: Node100/587; jsdom50/143. Updated production build is pending below.

Unverified: fresh PostgreSQL migration execution, legacy reconciliation, real SQL query plans and RLS/table/column role enforcement, Auth/recovery/session lifecycle, SMTP/OTP, Storage, Realtime, TURN/multinetwork media, scheduled cron/Redis/proxy deployment, real Paystack, live AI accuracy/cancellation, browser screenshots/zoom/touch and CI execution. No hosted DDL/data writes, migrations/seeds, real provider calls, push or PR were made.

Outstanding local implementation: complete F49's remaining page strings/date formats. Full adherence dose-event modelling, broader audit/outbox/retention coverage and remaining dependency advisories remain follow-up gaps identified above. None is represented as complete. No new product decision blocks the remaining F49 work. Existing doctor's IANA timezone and the nalavita authoritative project decisions are honored. Dependency major upgrades/downgrades and legal/compliance text require separate review rather than automatic changes.

Pre-launch gates: complete localization and native-speaker review; obtain legal consent/privacy/retention approval; reconcile the legacy DB and rehearse migrations/restore; test synthetic role/grant/revocation isolation and real booking/payment races; configure SMTP/recovery templates/redirects and test delivery; provision private Storage/Realtime, TURN and cross-network media; deploy/verify Redis, trusted proxy headers and the reminder scheduler; exercise Paystack sandbox callback/signature/replay/reconciliation before controlled live activation; rerun dependency audit; have the user push and require all CI jobs to pass; complete browser accessibility/theme/viewport journeys and an independent penetration test. **Do not deploy this branch solely because local suites pass.**
