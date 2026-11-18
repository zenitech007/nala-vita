-- SELECT only, before/after migration. Missing is explicit, not a successful check.
WITH expected(table_name) AS (VALUES
  ('patients'), ('admins'), ('appointments'), ('prescriptions'), ('vitals'),
  ('lab_orders'), ('lab_results'), ('medical_notes'), ('messages'), ('referrals'),
  ('payments'), ('payment_attempts'), ('payment_provider_events'), ('notifications'),
  ('bed_resources'), ('file_uploads'), ('audit_logs'), ('amelia_conversations'),
  ('amelia_messages'), ('amelia_memories'), ('reminders'), ('otp_challenges'),
  ('claim_invitations'), ('otp_verification_budgets'), ('facilities'),
  ('facility_memberships'), ('record_access_requests'), ('record_access_grants'), ('record_access_logs'), ('doctor_verifications', 'refill_requests', 'daily_vital_snapshots')
)
SELECT e.table_name, CASE WHEN c.oid IS NULL THEN 'MISSING'
  WHEN NOT c.relrowsecurity THEN 'FAIL_RLS'
  WHEN EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=e.table_name) THEN 'FAIL_UNEXPECTED_POLICY'
  WHEN EXISTS (
    SELECT 1 FROM (VALUES ('anon'), ('authenticated')) roles(role_name)
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) privileges(privilege_name)
    WHERE has_table_privilege(role_name,c.oid,privilege_name)
  ) THEN 'FAIL_TABLE_PRIVILEGE'
  WHEN EXISTS (
    SELECT 1 FROM pg_attribute a
    CROSS JOIN (VALUES ('anon'), ('authenticated')) roles(role_name)
    CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) privileges(privilege_name)
    WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      AND has_column_privilege(role_name,c.oid,a.attnum,privilege_name)
  ) THEN 'FAIL_COLUMN_PRIVILEGE'
  ELSE 'PASS_CATALOG_ONLY' END AS result
FROM expected e LEFT JOIN pg_namespace n ON n.nspname='public'
LEFT JOIN pg_class c ON c.relnamespace=n.oid AND c.relname=e.table_name AND c.relkind='r'
ORDER BY e.table_name;

-- Identify unexpected exposed-schema tables for separate review.
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;

-- Catalog inventory only; effective runtime Prisma role must be checked separately.
SELECT r.rolname, r.rolbypassrls FROM pg_roles r WHERE r.rolname=current_user;
SELECT pg_get_userbyid(d.defaclrole) AS creator_role, n.nspname, d.defaclobjtype, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace WHERE n.nspname='public';
