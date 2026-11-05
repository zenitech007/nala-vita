-- Authoritative project's inspection found zero vitals. Other databases must not guess units.
-- See docs/migrations/temperature-backfill.md before applying anywhere with legacy readings.
BEGIN;
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM vitals WHERE temperature IS NOT NULL) THEN
    RAISE EXCEPTION 'F21: legacy temperatures require explicit unit classification and preservation before conversion';
  END IF;
END
$preflight$;
ALTER TABLE vitals
  ADD COLUMN temperature_unit TEXT NOT NULL DEFAULT 'C' CHECK (temperature_unit = 'C'),
  ADD COLUMN temperature_original DOUBLE PRECISION,
  ADD COLUMN temperature_original_unit TEXT CHECK (temperature_original_unit IN ('C', 'F')),
  ADD CONSTRAINT vitals_temperature_provenance CHECK (
    (temperature IS NULL AND temperature_original IS NULL AND temperature_original_unit IS NULL)
    OR (temperature IS NOT NULL AND temperature_original IS NOT NULL AND temperature_original_unit IS NOT NULL)
  );
COMMIT;
