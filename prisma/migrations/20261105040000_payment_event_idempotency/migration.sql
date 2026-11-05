BEGIN;
ALTER TABLE payment_attempts ADD COLUMN provider_transaction_id TEXT;
CREATE UNIQUE INDEX "payment_attempts_provider_transaction_id_key" ON payment_attempts(provider_transaction_id);
CREATE TABLE payment_provider_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  provider_transaction_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL REFERENCES payment_attempts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "payment_provider_events_attempt_id_created_at_idx" ON "payment_provider_events"("attempt_id", "created_at");
ALTER TABLE payment_provider_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payment_provider_events FROM anon, authenticated;
COMMIT;
