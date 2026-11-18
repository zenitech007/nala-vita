-- Existing identity bindings are preserved. Never clear a legacy Supabase UUID
-- from email/phone matching; reconcile it against Auth before marking it unbound.
BEGIN;
ALTER TABLE users ALTER COLUMN supabase_id DROP NOT NULL, ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN verified_phone TEXT;
ALTER TABLE patients ADD COLUMN created_by_doctor_id TEXT REFERENCES doctors(id) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE otp_challenges (
  id TEXT PRIMARY KEY, recipient_hash TEXT NOT NULL, ip_hash TEXT NOT NULL, purpose TEXT NOT NULL,
  target_user_id TEXT REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  binding_hash TEXT NOT NULL, code_hash TEXT NOT NULL, context JSONB NOT NULL,
  expires_at TIMESTAMP(3) NOT NULL, attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at TIMESTAMP(3), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "otp_challenges_recipient_hash_created_at_idx" ON "otp_challenges"("recipient_hash", "created_at");
CREATE INDEX "otp_challenges_ip_hash_created_at_idx" ON "otp_challenges"("ip_hash", "created_at");
CREATE TABLE claim_invitations (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE ON UPDATE CASCADE,
  issuer_doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE ON UPDATE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMP(3) NOT NULL, used_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "claim_invitations_patient_id_expires_at_idx" ON "claim_invitations"("patient_id", "expires_at");
CREATE TABLE otp_verification_budgets (id TEXT PRIMARY KEY, window_start TIMESTAMP(3) NOT NULL, count INTEGER NOT NULL CHECK (count BETWEEN 1 AND 30));
ALTER TABLE otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_verification_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON otp_challenges, claim_invitations, otp_verification_budgets FROM anon, authenticated;
COMMIT;
