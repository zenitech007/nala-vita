# Supabase + Paystack Setup — Verified 2026-05-22

This document records the steps used to wire the live Supabase Postgres
database and Paystack test-mode credentials to the Nala Vita codebase, plus
the resulting state.

## Outcome

| Service | Status | Notes |
|---|---|---|
| Supabase Postgres (schema) | ✅ pushed | 17 tables + 4 enums, via `prisma db push` |
| Supabase Postgres (runtime) | ✅ connected | Confirmed by counting rows in all 17 tables via the pooled runtime adapter |
| Supabase RLS policies | ✅ applied | 60 policies across 16 tables (everything except `audit_logs` write paths is now RLS-protected) |
| OpenAI | ✅ live | gpt-4o accessible with the configured key |
| Paystack | ⚠️ keys are placeholders | `sk_test_placeholder` / `pk_test_placeholder` / `whsec_placeholder` — payment flow won't actually charge until real test keys are pasted into `.env` |

## What was done

### 1. Schema push

```bash
npx prisma db push --accept-data-loss
```

Dropped two pre-existing stale tables in the Supabase DB (`zendaya_messages`, `zendaya_sessions`) that were leftover from an unrelated prior project, then pushed the Nala Vita schema cleanly.

### 2. Schema fix: `supabaseId` → UUID

The first RLS apply failed with `operator does not exist: text = uuid` because Prisma had pushed `User.supabaseId` as `text` while Supabase's `auth.uid()` returns `uuid`. Fixed by:

```prisma
model User {
  supabaseId  String  @unique @map("supabase_id") @db.Uuid
  ...
}
```

Then re-pushed. The TypeScript side is still `string` (no code changes needed); only the Postgres column type changed.

### 3. RLS policies

```bash
# Single SQL transaction containing supabase/rls-policies.sql
node ./scripts-apply-rls.mjs
```

60 policies applied. Verified via:

```sql
SELECT tablename, COUNT(*) FROM pg_policies
WHERE schemaname = 'public' GROUP BY tablename;
```

### 4. OpenAI verification

`GET https://api.openai.com/v1/models` with the configured key returned 200 and 118 models including `gpt-4o`. The three AI routes (`/api/ai/symptom-check`, `/api/ai/diagnosis-support`, `/api/ai/risk-score`) can now hit the real OpenAI API.

### 5. Paystack — pending

`GET https://api.paystack.co/balance` with the configured key returned 401 `Invalid key`. Both `PAYSTACK_SECRET_KEY` and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` are 19 chars long and end with `"lder"` — i.e., they're still the `sk_test_placeholder` / `pk_test_placeholder` strings from the Phase 1 preflight. The webhook secret (`PAYSTACK_WEBHOOK_SECRET`) is also the placeholder.

**To activate payments:** open the Paystack dashboard (Settings → API Keys & Webhooks), copy the test-mode secret key + public key + webhook secret into `.env`, then test by submitting any patient payment.

## Required env vars (current `.env`)

| Var | Source | Status |
|---|---|---|
| `DATABASE_URL` | Supabase → Connection string (Pooler 5432) | ✅ |
| `DIRECT_URL` | Supabase → Connection string (Direct 5432) | ✅ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API Settings → anon | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API Settings → service_role | ✅ |
| `OPENAI_API_KEY` | OpenAI dashboard | ✅ |
| `PAYSTACK_SECRET_KEY` | Paystack → API Keys → secret | ⚠️ placeholder |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack → API Keys → public | ⚠️ placeholder |
| `PAYSTACK_WEBHOOK_SECRET` | Paystack → Webhooks → secret | ⚠️ placeholder |
