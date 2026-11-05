# Email OTP and provisional record claims

All delivery is email-only. `OTP_CHANNEL=email` and `OTP_SMS_ENABLED=false` are
the shipped defaults. The SMS channel deliberately throws `SMS not enabled`.

Configure `OTP_HASH_SECRET` to an independently generated secret of at least
32 characters. Configure `OTP_SMTP_HOST`, `OTP_SMTP_PORT`, `OTP_SMTP_USER`,
`OTP_SMTP_PASSWORD` and `OTP_EMAIL_FROM` using your SMTP provider and secret
manager. Port 465 uses implicit TLS; other ports require STARTTLS. Credentials
and OTPs must not be logged. The application does not read Supabase's Auth SMTP
credentials; configure its transport separately, even if using the same provider.

In production, `OTP_TRUSTED_IP_HEADER` must name a single-IP header that the
trusted deployment proxy overwrites. Strip any client-supplied value at the edge.
Missing/invalid trusted IP configuration fails closed. Development uses one local
IP bucket. Issuance is limited to 5 per normalized email/hour, 20 per IP/hour and
a 60-second per-email cooldown; verification is limited to 30 requests/IP/minute.
Limits and consumption use database transactions and locks across app instances.

Six-digit codes are HMAC-hashed with unique challenge/binding material, expire
after 10 minutes, lock after 5 incorrect attempts and are single-use. The stored
purpose/binding prevents a claim proof from approving record access or changing
the approved scope. Requests return an opaque challenge ID and the same generic
message whether the recipient exists, is rate-limited or is not eligible. SMTP
failure never produces a false claim of delivery. Monitor the generic delivery
failure log and provider delivery telemetry without logging recipient/code data.

New clinic records have `supabase_id=NULL`; phone-only records may also have
`email=NULL`. A patient claims using the email already on file, or a single-use
24-hour invitation issued by the clinic that created the unbound record. An
invitation also requires OTP verification of the chosen email. Phone matching
never binds identity. Historical random UUID bindings are left untouched until
reconciled against Auth by a reviewed migration; do not guess from contact data.

Clinic invitation issuance: `POST /api/patients/:id/invitation`, authenticated as
the active, verified originating doctor. Give the returned code privately to the
patient. Never put it in an audit log or public URL. Patient flow: `/claim`.
New registrations verify their email at `/verify-email`. Claim and registration
database failures attempt to delete only the Auth identity created by that
operation. If compensation fails, stop retries and reconcile the orphan account;
no existing Auth identity is deleted by a claim attempt.

Before production, test SMTP delivery/limits and Auth confirmation on a disposable
project, exercise concurrent claims against PostgreSQL, and verify rollback and
Auth compensation using designated test identities. These real-provider tests
have not been run. Purge expired challenges/invitations and old verification
budgets after the required abuse/audit retention window (at least 24 hours for
the hourly counters); no cleanup job or remote deletion was run during this batch.
