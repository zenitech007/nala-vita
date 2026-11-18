-- Apply only to an approved disposable database after scripts/verify-f14.sql.
-- Existing overlaps intentionally abort this transaction. No records are deleted.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
SET LOCAL search_path = public, extensions, pg_catalog;

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_duration_range" CHECK (duration BETWEEN 15 AND 120) NOT VALID,
  ADD CONSTRAINT "appointments_no_doctor_overlap" EXCLUDE USING gist (
    doctor_id WITH =,
    tsrange(scheduled_at, scheduled_at + duration * INTERVAL '1 minute', '[)') WITH &&
  ) WHERE (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')),
  ADD CONSTRAINT "appointments_no_patient_overlap" EXCLUDE USING gist (
    patient_id WITH =,
    tsrange(scheduled_at, scheduled_at + duration * INTERVAL '1 minute', '[)') WITH &&
  ) WHERE (status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'));
COMMIT;
