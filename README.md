# Nala Vita

Nala Vita is a Next.js 16 App Router application for patient records, clinician workflows, appointments, messaging, telemedicine and payments. It uses TypeScript, Prisma 7 with the PostgreSQL adapter, Supabase Auth/Storage/Realtime, React Query, next-intl, Tailwind and local Geist fonts.

## Local setup

Use Node.js 22 and npm. Copy the documented variable names from .env.example into a local .env and supply credentials for an approved development project. Align the Supabase URL, browser key, service-role key and PostgreSQL URLs to the same project. The user-designated authoritative project is the currently connected Nala Vita project. Local environment alignment still needs operator verification.

Run npm ci, then npm run dev. Installation generates the Prisma client. Open http://localhost:3000. Source routes live under src/app. Patient, doctor and admin role layouts resolve verified Auth identity and database roles. API guards independently enforce role, active status and target-record access.

## Environment

| Variable group | Purpose |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY | Browser and SSR Auth clients |
| SUPABASE_SERVICE_ROLE_KEY | Server-only Storage and authorized Realtime publishing |
| DATABASE_URL | Runtime PostgreSQL connection |
| DIRECT_URL | Explicit migration connection |
| NEXT_PUBLIC_APP_URL | Trusted application origin, redirects and recovery |
| GEMINI_API_KEY or GOOGLE_API_KEY | Primary AI provider |
| OPENAI_API_KEY | Optional OpenAI fallback |
| PAYSTACK_SECRET_KEY | Payment provider credentials |
| UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN | Shared rate limiting |
| TRUSTED_CLIENT_IP_HEADER | Single client-IP header set and sanitized by the trusted proxy |
| OTP_HASH_SECRET | At least 32 random characters for OTP hashes and recovery proof signing |
| OTP_SMTP_HOST, OTP_SMTP_PORT, OTP_SMTP_USER, OTP_SMTP_PASSWORD, OTP_EMAIL_FROM | Application email transport |
| OTP_CHANNEL | Email by default |
| CRON_SECRET | At least 32 random characters for the reminder scheduler |
| TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL | Operator-provided TURN relay configuration |
| UPLOAD_QUOTA_BYTES | Per-user upload quota, default 100 MiB |

Public-prefixed values are bundled for browsers. Server secrets stay in the deployment secret store. Recovery email configuration belongs to Supabase Auth's SMTP and email templates. Application verification emails use the configured application SMTP transport.

## Checks

Run npx tsc --noEmit, npm run lint and npm run test:contrast. Run the Node Jest project with NODE_OPTIONS=--max-old-space-size=512 and npx jest --selectProjects node --runInBand. Run UI tests with npx jest --selectProjects jsdom --runInBand. Build with npm run build.

On PowerShell, set the Jest budget with $env:NODE_OPTIONS='--max-old-space-size=512' and remove that environment variable before running TypeScript or the production build.

The audit report records current lint violations and semantic test-source type errors. Node Jest transform diagnostics are enabled with isolated transformation. A full semantic test check is node node_modules/typescript/bin/tsc --project tsconfig.test.json --noEmit. Its current errors remain an explicit quality gap.

GitHub Actions defines install, production TypeScript, lint, Node/UI Jest, contrast and build gates. A separate job applies migrations to a fresh PostgreSQL 17 service with minimal disposable Supabase catalog stubs. GitHub execution and managed Supabase integration remain unverified locally.

## Database deployment

Review AUDIT_REPORT.md and the migration runbooks before rollout. Validate the complete migration chain on a fresh disposable database first. The connected hosted database has legacy schema drift and requires baseline reconciliation before an operator approves deployment. All audit migrations remain written and unapplied by the agent.

The CI bootstrap SQL is for its disposable Postgres service. Production Supabase owns its Auth and Realtime schemas. Apply the application migration directories in lexical timestamp order after approved reconciliation. Never use seed scripts to verify a real patient environment.

## Architecture

The browser authenticates through the cookie-aware Supabase client. Middleware verifies Auth identity. Role layouts and API boundaries resolve the authoritative user and profiles from PostgreSQL. Record visibility combines authorship, care relationships, source ownership and approved sharing grants.

Prisma uses a process-reused PostgreSQL adapter and pool. Clinical writes use target-access checks. Payments persist checkout attempts and process provider events idempotently. Amounts retain decimal precision through the payment boundary.

Amelia screens raw submitted messages for red flags, loads the latest bounded history, and calls Gemini or the OpenAI fallback. Image extraction returns unavailable when providers cannot read an image. Streaming stops after a provider fails once output has started. Provider calls have explicit deadlines. Medication safety output is schema-validated with bounded, versioned caching.

Chat and consultation signaling use private channels and server-authorized publication. Deploy the written Realtime policies and configure TURN before verifying remote media. Uploads share bounded body reading, file-signature validation, quota reservations and cleanup.

## Operations

The health endpoint reports process liveness. Readiness reports database reachability with a bounded read-only probe. Their scope does not establish regulatory compliance or end-to-end provider availability.

Configure the reminder scheduler as described in docs/reminders.md. It delivers in-app notifications with atomic claiming and idempotent transaction delivery. Existing reminders need an explicit timezone before recreation.

Route structured audit.write_failed and reminder.worker_failed events to the hosting log collector and configure operational alerts. Investigate the process-local rate-limit warning and configure Upstash for shared production limits. Reconcile retained upload reservations when cleanup fails.

For an incident, preserve relevant event timestamps and request identifiers, restrict the affected workflow, verify Auth/session status, check provider delivery status and reconcile durable payment/reminder state before retrying. Keep personal records and contact details out of diagnostic exports.

Rollback application code to the previously validated deployment. Database changes require a reviewed forward repair or an approved restore plan. Test backups in a disposable restore drill and verify record counts and access policies before returning traffic.

## Release verification

Configure custom SMTP, recovery templates and redirect allowlists. Test TURN from separate networks. Configure Paystack live credentials only for the approved production deployment and verify callbacks. Complete legal review of consent/privacy/compliance wording, a restore drill and a penetration test. Verify the pending migration chain, real role/target isolation, provider timeout behavior, accessibility and browser layouts. The Fix log distinguishes local checks from deployment verification.
