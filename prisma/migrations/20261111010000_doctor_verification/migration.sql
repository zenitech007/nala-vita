CREATE TABLE doctor_verifications (
  doctor_id text PRIMARY KEY REFERENCES doctors(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  reason text,
  reviewer_id text REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp(3),
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL,
  CONSTRAINT verification_reason_length CHECK (reason IS NULL OR length(reason) <= 1000)
);
INSERT INTO doctor_verifications (doctor_id, status, updated_at)
SELECT id, CASE WHEN is_verified THEN 'VERIFIED' ELSE 'PENDING' END, CURRENT_TIMESTAMP FROM doctors;
CREATE INDEX doctor_verifications_status_updated_at_idx ON "doctor_verifications"("status", "updated_at");
DO $$
DECLARE private_table text; private_columns text;
BEGIN
  FOREACH private_table IN ARRAY ARRAY['doctor_verifications'] LOOP
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
