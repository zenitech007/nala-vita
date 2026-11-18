-- Apply after identity and private clinical-table RLS. Supabase Realtime manages realtime.messages.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('realtime.messages') AND relrowsecurity) THEN
    RAISE EXCEPTION 'Supabase Realtime messages with RLS enabled is required';
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS nala_private;
REVOKE ALL ON SCHEMA nala_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA nala_private TO authenticated;

-- Private boolean lookup. Application tables are intentionally unreadable by browser roles.
CREATE FUNCTION nala_private.realtime_member(topic_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users AS viewer
    LEFT JOIN public.patients AS vp ON vp.user_id = viewer.id
    LEFT JOIN public.doctors AS vd ON vd.user_id = viewer.id
    WHERE viewer.supabase_id = (SELECT auth.uid())
      AND viewer.is_active
      AND ((viewer.role = 'PATIENT' AND vp.id IS NOT NULL)
        OR (viewer.role = 'DOCTOR' AND vd.is_verified))
      AND (
        topic_name = 'nala:chat:' || viewer.id
        OR (
          topic_name ~ '^nala:call:[a-zA-Z0-9_-]{1,128}:[a-zA-Z0-9_-]{1,128}$'
          AND split_part(topic_name, ':', 4) = viewer.id
          AND EXISTS (
            SELECT 1 FROM public.appointments a
            JOIN public.patients p ON p.id = a.patient_id
            JOIN public.users pu ON pu.id = p.user_id
            JOIN public.doctors d ON d.id = a.doctor_id
            JOIN public.users du ON du.id = d.user_id
            WHERE a.id = split_part(topic_name, ':', 3)
              AND a.consultation_type = 'VIDEO'
              AND a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
              AND pu.is_active AND pu.role = 'PATIENT'
              AND du.is_active AND du.role = 'DOCTOR' AND d.is_verified
              AND (pu.id = viewer.id OR du.id = viewer.id)
          )
        )
      )
  );
$$;
REVOKE ALL ON FUNCTION nala_private.realtime_member(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION nala_private.realtime_member(text) TO authenticated;

CREATE POLICY nala_member_receive ON realtime.messages FOR SELECT TO authenticated
  USING (extension = 'broadcast' AND nala_private.realtime_member((SELECT realtime.topic())));
CREATE POLICY nala_member_receive_boundary ON realtime.messages AS RESTRICTIVE FOR SELECT TO authenticated
  USING ((SELECT realtime.topic()) NOT LIKE 'nala:%'
    OR (extension = 'broadcast' AND nala_private.realtime_member((SELECT realtime.topic()))));
CREATE POLICY nala_no_anon_receive ON realtime.messages AS RESTRICTIVE FOR SELECT TO anon
  USING ((SELECT realtime.topic()) NOT LIKE 'nala:%');
-- Server publishes using its service role after rechecking identity and membership.
CREATE POLICY nala_server_only_send ON realtime.messages AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK ((SELECT realtime.topic()) NOT LIKE 'nala:%');
COMMIT;
