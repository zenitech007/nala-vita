CREATE TABLE refill_requests (
 id text PRIMARY KEY,
 prescription_id text NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
 requester_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','DENIED')),
 reason text CHECK (reason IS NULL OR length(reason) BETWEEN 3 AND 1000),
 reviewer_id text REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at timestamp(3),
 created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at timestamp(3) NOT NULL,
 CONSTRAINT refill_review_state CHECK ((status = 'PENDING' AND reviewed_at IS NULL AND reviewer_id IS NULL) OR (status <> 'PENDING' AND reviewed_at IS NOT NULL AND reason IS NOT NULL))
);
CREATE UNIQUE INDEX refill_requests_one_pending_idx ON refill_requests(prescription_id) WHERE status = 'PENDING';
CREATE INDEX refill_requests_prescription_status_created_idx ON "refill_requests"("prescription_id", "status", "created_at");
CREATE INDEX refill_requests_requester_created_idx ON "refill_requests"("requester_id", "created_at");
DO $$
DECLARE private_table text; private_columns text;
BEGIN
  FOREACH private_table IN ARRAY ARRAY['refill_requests'] LOOP
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
