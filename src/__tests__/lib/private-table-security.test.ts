import { existsSync, readFileSync } from 'node:fs';
const migration = 'prisma/migrations/20261106020000_private_clinical_and_amelia_rls/migration.sql';
const sql = existsSync(migration) ? readFileSync(migration, 'utf8') : '';
it('F18 protects every application data table outside the self-profile exception', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const tables = [...schema.matchAll(/@@map\("([^"]+)"\)/g)].map(match => match[1]).filter(name => !['users', 'doctors'].includes(name));
  expect(tables.filter(table => !sql.includes(`'${table}'`))).toEqual([]);
  expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
  expect(sql).toContain('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC, anon, authenticated');
  expect(sql).toContain('REVOKE ALL PRIVILEGES (%s) ON TABLE public.%I FROM PUBLIC, anon, authenticated');
});
it('F18 default deny cannot silently combine unexpected permissive policies', () => {
  expect(sql).toContain('Unexpected policies');
  expect(sql).toContain('Required private table missing');
  expect(sql).not.toMatch(/CREATE POLICY|SECURITY DEFINER|GRANT ALL|GRANT SELECT/i);
  expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|TRUNCATE TABLE/i);
});
