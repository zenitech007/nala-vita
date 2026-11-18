import { existsSync, readFileSync } from 'node:fs';
const path = 'prisma/migrations/20261106010000_identity_column_privileges/migration.sql';
const sql = existsSync(path) ? readFileSync(path, 'utf8') : '';
it('F05 removes inherited table and pre-existing column privileges before granting safe updates', () => {
  expect(sql).toContain('REVOKE ALL PRIVILEGES ON TABLE public.users, public.doctors FROM PUBLIC, anon, authenticated');
  expect(sql).toMatch(/REVOKE ALL PRIVILEGES \(%s\) ON TABLE public\.%I FROM PUBLIC, anon, authenticated/);
  const updates = [...sql.matchAll(/GRANT UPDATE\s*\(([^)]+)\) ON TABLE public\.(\w+)/g)].map(match => [match[2], match[1].split(',').map(v => v.trim())]);
  expect(updates).toEqual([['users', ['first_name', 'last_name', 'avatar_url']], ['doctors', ['bio']]]);
  expect(sql.indexOf('REVOKE ALL PRIVILEGES ON TABLE')).toBeLessThan(sql.indexOf('GRANT UPDATE'));
});
it('F05 safe updates are self-only, active, and cannot rebind identity or promote roles', () => {
  expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(2);
  expect(sql.match(/FOR UPDATE TO authenticated/g)).toHaveLength(2);
  expect(sql.match(/WITH CHECK/g)).toHaveLength(2);
  expect(sql).toContain('supabase_id::text = (SELECT auth.uid())::text');
  expect(sql).not.toMatch(/SECURITY DEFINER|user_metadata|GRANT ALL/i);
  expect(sql).toContain('Unexpected identity policies');
});
