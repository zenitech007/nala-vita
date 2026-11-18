-- F18: application APIs are the sole clinical/consent access path.
-- Nov 6 inspection: all 17 legacy public tables have no RLS/policies and broad
-- browser privileges. Amelia/new tables require the preceding migration chain.
BEGIN;
DO $$
DECLARE private_table text; private_columns text;
BEGIN
  FOREACH private_table IN ARRAY ARRAY[
    'patients', 'admins', 'appointments', 'prescriptions', 'vitals',
    'lab_orders', 'lab_results', 'medical_notes', 'messages', 'referrals',
    'payments', 'payment_attempts', 'payment_provider_events', 'notifications',
    'bed_resources', 'file_uploads', 'audit_logs', 'amelia_conversations',
    'amelia_messages', 'amelia_memories', 'reminders', 'otp_challenges',
    'claim_invitations', 'otp_verification_budgets', 'facilities',
    'facility_memberships', 'record_access_requests', 'record_access_grants', 'record_access_logs'
  ] LOOP
    IF to_regclass(format('public.%I', private_table)) IS NULL THEN
      RAISE EXCEPTION 'Required private table missing: %. Reconcile migration history first.', private_table;
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

-- Applies to future tables created by this migration role only. Every future
-- application table must still explicitly enable RLS and define its API access.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC, anon, authenticated;
COMMIT;
