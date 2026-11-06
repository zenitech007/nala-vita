# Security migration verification

All Batch 2 migrations are written, **not applied**. The authoritative inspected
project is `nypygbqncavvejmhrwbt`. It has existing identities, no migration history,
17 legacy tables versus 21 baseline tables, text rather than UUID Supabase IDs,
and a legacy Stripe column rather than the Paystack reference. Never mark the
baseline applied or run the forward chain against it without reconciliation.
The local environment still names a different project; no secrets were changed.

Use an explicitly approved disposable Supabase database with the Auth schema and
`anon`/`authenticated` roles for actual migration and authorization tests. First
apply the unchanged baseline and forward chain there. Separately reconcile a
schema-only copy of the legacy project, check compatibility, and review the
resulting migration history. Do not copy patient rows or assume an empty patient
table makes the existing project disposable. No seed or remote write is authorized.

F05 revokes table **and column** privileges inherited from PUBLIC, anon and
authenticated, then permits only names/avatar and a doctor's own bio through
active self-only RLS. Identity binding, contact verification, role, activation,
doctor verification, fees and availability stay server-only. There is no direct
browser INSERT/DELETE/TRUNCATE. Existing unexpected identity policies abort the
migration for review rather than silently combining permissive policies.

Clinical/consent/OTP data uses guarded application APIs with Prisma. There are no
direct browser table clients in these flows. F18 therefore uses RLS default deny
plus explicit browser privilege revocation, rather than duplicating the central
grant policy in a second browser access path. Runtime Prisma must use a protected
server role with the intended ownership/BYPASSRLS behavior; never a browser key.
This deployment's runtime connection and custom role have not been verified.

Run `scripts/verify-f05.sql`, `verify-f18.sql`, `verify-record-access.sql`,
`verify-f17.sql` and `verify-f14.sql` before/after applying to that approved database.
The scripts read catalogs/counts only; before migration, FAIL/MISSING is expected.
Keep their outputs with the migration review. These catalog checks do not prove
row-level behavior. In the disposable database, use synthetic patient A/B,
active/inactive clinician, verified/pending clinician and admin identities to test
own safe updates, denied role/activation/verification/identity rebinding, denied
cross-user edits, denied anonymous access, denied clinical/access/OTP table access,
and normal guarded API behavior. Exercise revocation and expiry during reads.

Check Data API exposed schemas, Storage policies, Realtime public channels,
Auth email confirmation/rate limits and custom SMTP in the Dashboard separately;
the available plugin cannot verify all of those service settings. SQL catalog
checks cannot establish SMTP delivery or API runtime identity behavior.

References: [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security),
[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
