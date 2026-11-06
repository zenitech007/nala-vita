-- F05. Written from the Nov 5/6 catalog inspection of nypygbqncavvejmhrwbt:
-- no public policies; anon/authenticated had all table privileges and sensitive UPDATE.
-- Apply through Prisma only after legacy baseline reconciliation, on an approved dev DB.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('users', 'doctors')) THEN
    RAISE EXCEPTION 'Unexpected identity policies: inspect and reconcile before applying F05';
  END IF;
END $$;

-- Table privileges override column revocations. Remove both, including inherited PUBLIC.
REVOKE ALL PRIVILEGES ON TABLE public.users, public.doctors FROM PUBLIC, anon, authenticated;
DO $$
DECLARE identity_table text; identity_columns text;
BEGIN
  FOREACH identity_table IN ARRAY ARRAY['users', 'doctors'] LOOP
    SELECT string_agg(format('%I', attname), ', ' ORDER BY attnum) INTO identity_columns
      FROM pg_attribute WHERE attrelid = format('public.%I', identity_table)::regclass
      AND attnum > 0 AND NOT attisdropped;
    EXECUTE format('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated', identity_columns, identity_table);
  END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Identity binding, email proof, roles, activation, verification, fees and booking
-- configuration remain server-only. No browser INSERT, DELETE, TRUNCATE or REFERENCES.
GRANT SELECT ON TABLE public.users, public.doctors TO authenticated;
GRANT UPDATE (first_name, last_name, avatar_url) ON TABLE public.users TO authenticated;
GRANT UPDATE (bio) ON TABLE public.doctors TO authenticated;

CREATE POLICY identity_self_read ON public.users FOR SELECT TO authenticated
  USING (is_active AND supabase_id::text = (SELECT auth.uid())::text);
CREATE POLICY identity_self_safe_update ON public.users FOR UPDATE TO authenticated
  USING (is_active AND supabase_id::text = (SELECT auth.uid())::text)
  WITH CHECK (is_active AND supabase_id::text = (SELECT auth.uid())::text);
CREATE POLICY doctor_self_read ON public.doctors FOR SELECT TO authenticated
  USING (user_id IN (SELECT id FROM public.users WHERE is_active AND role = 'DOCTOR' AND supabase_id::text = (SELECT auth.uid())::text));
CREATE POLICY doctor_self_safe_update ON public.doctors FOR UPDATE TO authenticated
  USING (is_verified AND user_id IN (SELECT id FROM public.users WHERE is_active AND role = 'DOCTOR' AND supabase_id::text = (SELECT auth.uid())::text))
  WITH CHECK (is_verified AND user_id IN (SELECT id FROM public.users WHERE is_active AND role = 'DOCTOR' AND supabase_id::text = (SELECT auth.uid())::text));
COMMIT;
