-- SELECT only. Safe before/after migration. All server_only_protected must be true.
WITH protected(table_name, column_name) AS (
  VALUES ('users','role'), ('users','is_active'), ('users','supabase_id'),
    ('users','email_verified'), ('users','email'), ('doctors','is_verified'),
    ('doctors','user_id'), ('doctors','consultation_fee')
), roles(role_name) AS (VALUES ('anon'), ('authenticated'))
SELECT role_name, table_name, column_name,
  NOT has_column_privilege(role_name, format('public.%I', table_name), column_name, 'UPDATE')
  AND NOT has_column_privilege(role_name, format('public.%I', table_name), column_name, 'INSERT') AS server_only_protected
FROM protected CROSS JOIN roles ORDER BY table_name, column_name, role_name;

SELECT role_name, table_name,
  NOT has_table_privilege(role_name, format('public.%I', table_name), 'TRUNCATE') AS truncate_denied,
  NOT has_table_privilege(role_name, format('public.%I', table_name), 'UPDATE') AS broad_update_denied,
  has_column_privilege(role_name, format('public.%I', table_name), safe_column, 'UPDATE') AS safe_column_update
FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
CROSS JOIN (VALUES ('users','first_name'), ('doctors','bio')) AS tables(table_name,safe_column);

SELECT c.relname, c.relrowsecurity, p.policyname, p.roles, p.cmd, p.qual, p.with_check
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname=n.nspname AND p.tablename=c.relname
WHERE n.nspname='public' AND c.relname IN ('users','doctors') ORDER BY c.relname,p.policyname;
