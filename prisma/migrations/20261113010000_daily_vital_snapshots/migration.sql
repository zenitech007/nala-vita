CREATE TABLE daily_vital_snapshots (
 id text PRIMARY KEY,
 patient_id text NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
 day text NOT NULL,
 time_zone text NOT NULL,
 water_liters double precision NOT NULL CHECK (water_liters >= 0 AND water_liters <= 30),
 steps integer NOT NULL CHECK (steps >= 0 AND steps <= 2000000),
 meds_taken boolean NOT NULL,
 created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX daily_vital_snapshots_patient_day_zone_key ON "daily_vital_snapshots"("patient_id", "day", "time_zone");
DO $$
DECLARE private_table text; private_columns text;
BEGIN
  FOREACH private_table IN ARRAY ARRAY['daily_vital_snapshots'] LOOP
    IF to_regclass(format('public.%I', private_table)) IS NULL THEN
      RAISE EXCEPTION 'Required private table missing: %', private_table;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=private_table) THEN
      RAISE EXCEPTION 'Unexpected policies on %: review before applying default deny', private_table;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', private_table);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated', private_table);
    SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum) INTO private_columns
      FROM pg_attribute WHERE attrelid=format('public.%I', private_table)::regclass
      AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated', private_columns, private_table);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
