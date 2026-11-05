-- No provider calls. Do not apply before reconciling the remote baseline/history.
BEGIN;
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM payments WHERE amount < 0 OR amount >= 10000000000
      OR amount::text IN ('NaN', 'Infinity', '-Infinity') OR amount::numeric <> round(amount::numeric, 2))
    OR EXISTS (SELECT 1 FROM doctors WHERE consultation_fee < 0 OR consultation_fee >= 10000000000
      OR consultation_fee::text IN ('NaN', 'Infinity', '-Infinity') OR consultation_fee::numeric <> round(consultation_fee::numeric, 2)) THEN
    RAISE EXCEPTION 'F16: invalid or sub-cent legacy money requires reviewed reconciliation; no automatic rounding';
  END IF;
END
$preflight$;
ALTER TABLE doctors ALTER COLUMN consultation_fee TYPE DECIMAL(12,2) USING consultation_fee::numeric;
ALTER TABLE payments ALTER COLUMN amount TYPE DECIMAL(12,2) USING amount::numeric;
CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  patient_id TEXT NOT NULL,
  appointment_id TEXT NOT NULL,
  reference TEXT NOT NULL UNIQUE,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0 AND amount_minor <= 9007199254740991),
  currency TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'test' CHECK (domain = 'test'),
  status TEXT NOT NULL DEFAULT 'INITIATING',
  authorization_url TEXT,
  access_code TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX "payment_attempts_payment_id_status_idx" ON "payment_attempts"("payment_id", "status");
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_attempts FROM anon, authenticated;
COMMIT;
