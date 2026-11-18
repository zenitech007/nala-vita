-- Disposable CI Postgres only. These stubs test application migration compilation.
-- Managed Supabase Auth and Realtime behavior requires separate integration checks.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE SCHEMA realtime;
CREATE TABLE realtime.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  extension text,
  topic text
);
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT current_setting('realtime.topic', true);
$$;
GRANT USAGE ON SCHEMA auth, realtime TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid(), realtime.topic() TO anon, authenticated;
GRANT SELECT, INSERT ON realtime.messages TO anon, authenticated;
