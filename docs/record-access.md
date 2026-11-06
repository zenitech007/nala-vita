# Patient-approved record access

Records retain their original author/provider. Approving a request creates a
directional, scoped, expiring copy/view grant; it does not move records or grant
the source provider access to the recipient's later records. Providers retain
their authored records. Revocation stops future reads under that grant, while
previously viewed or copied material cannot be recalled.

The patient reviews a named source and recipient, chooses requested record types
and duration (1–365 days), requests an email code, and approves. The OTP binding
includes request ID, sorted scope and duration. Source, recipient and patient IDs
are copied from the stored request, never from approval payload fields. Conditional
status updates prevent concurrent approval/deny/revoke races. A facility grant
applies only to its active verified clinician members; memberships have no public
self-join endpoint. Grant state, expiry and membership are checked on reads.

`getRecordVisibility` is the central clinical policy. It returns source filters
for each record type and writes clinician read logs. Source-private notes and
hidden prescriptions are excluded from sharing. Private notes remain author-only
within a facility. Patients retain their own record view. Inactive or unverified
clinicians cannot construct a visibility policy. The workspace relationship check
is separate from permission to read a provider's records; appointments/referrals
must not become unrestricted history grants.

Matching clinic intake returns a pending request and minimal status, without a
fake appointment, profile modification or initial note. Submitted clinical drafts
remain in the intake form; after approval the clinician adds notes through the
scoped record. Ambiguous phone matches fail closed. A new clinic-created patient
has an explicit creator; its new records receive authenticated provenance.

Patient UI: `/patient/access`, linked from Medical Records. Clinician UI:
`/doctor/record-access`, linked from Patients, optionally with a selected patient ID.
Requests generate an in-app notification and attempt email delivery using the
configured SMTP transport. Failed delivery is logged generically and does not
grant access or claim successful email delivery. A phone-only unclaimed record
cannot receive email; the clinic must provide its claim invitation first. Real
delivery has not been tested.

The forward migration maps only existing provider-of-record fields. It does not
infer facility affiliation or legacy vital authors from appointment relationships.
Unknown provenance stays unavailable to provider grants until reviewed; patients
can still view their own records. Legacy prescriptions labelled PATIENT receive
their patient's user as author. No clinical data is moved or deleted.

Apply only after baseline/history reconciliation and explicit approval for a
disposable database. New access/OTP tables are server-only with RLS enabled and
browser-role grants revoked. Browser requests use guarded application APIs.
`scripts/verify-record-access.sql` checks catalog state and post-migration
invariants using metadata/counts only. DDL application, PostgreSQL concurrency,
SMTP, browser and real-identity authorization checks remain unverified.
