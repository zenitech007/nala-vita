-- SELECT only. Inventory can run before application. The later invariant queries
-- require the forward migration; do not run them against an unreconciled schema.
WITH expected(name) AS (VALUES ('facilities'), ('facility_memberships'),
  ('record_access_requests'), ('record_access_grants'), ('record_access_logs'))
SELECT e.name, CASE WHEN c.oid IS NULL THEN 'MISSING'
  WHEN NOT c.relrowsecurity THEN 'RLS_DISABLED' ELSE 'RLS_ENABLED' END AS status,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') AS authenticated_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') AS authenticated_update
FROM expected e LEFT JOIN pg_namespace n ON n.nspname = 'public'
LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = e.name;

-- Post-migration invariants: all counts must be zero.
SELECT count(*) AS invalid_grant_binding_count FROM record_access_grants g
JOIN record_access_requests r ON r.id = g.request_id
WHERE g.patient_id <> r.patient_id
 OR g.requester_doctor_id IS DISTINCT FROM r.requester_doctor_id
 OR g.requester_facility_id IS DISTINCT FROM r.requester_facility_id
 OR g.source_doctor_id IS DISTINCT FROM r.source_doctor_id
 OR g.source_facility_id IS DISTINCT FROM r.source_facility_id
 OR g.source_user_id IS DISTINCT FROM r.source_user_id
 OR NOT (g.scope <@ r.scope);

SELECT count(*) AS invalid_patient_source_count FROM record_access_grants g
JOIN patients p ON p.id = g.patient_id WHERE g.source_user_id IS NOT NULL AND g.source_user_id <> p.user_id;

SELECT count(*) AS invalid_log_grant_patient_count FROM record_access_logs l
JOIN record_access_grants g ON g.id = l.grant_id WHERE l.patient_id <> g.patient_id;

-- Unknown provenance counts are review work, not permission to guess an author.
SELECT count(*) AS unclassified_vital_count FROM vitals
WHERE authored_by_doctor_id IS NULL AND authored_by_facility_id IS NULL AND authored_by_user_id IS NULL;
