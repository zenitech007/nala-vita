-- ═══════════════════════════════════════════════════════════
-- MediConnect — Supabase Row Level Security (RLS) Policies
-- ═══════════════════════════════════════════════════════════
--
-- Run these commands in the Supabase SQL Editor.
--
-- Prerequisites:
--   - Tables are created by Prisma migrations.
--   - The `users` table has a `supabase_id` column that maps
--     to Supabase auth.uid().
--   - Doctors are linked via doctors.user_id → users.id
--   - Patients are linked via patients.user_id → users.id
--
-- NOTE: Prisma connects via the service role key, which
-- bypasses RLS. These policies protect direct Supabase
-- client access (PostgREST / realtime / client SDK).
-- ═══════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────
-- 1. PATIENTS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Patient can read their own record
CREATE POLICY "Patients can view own record"
  ON patients
  FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE supabase_id = auth.uid()
    )
  );

-- Doctors can read patient records for patients they have
-- appointments with (ensures doctor-patient relationship)
CREATE POLICY "Doctors can view their patients"
  ON patients
  FOR SELECT
  USING (
    id IN (
      SELECT a.patient_id
      FROM appointments a
      INNER JOIN doctors d ON d.id = a.doctor_id
      INNER JOIN users u ON u.id = d.user_id
      WHERE u.supabase_id = auth.uid()
    )
  );

-- Admins can view all patient records
CREATE POLICY "Admins can view all patients"
  ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE supabase_id = auth.uid()
        AND role = 'ADMIN'
    )
  );


-- ─────────────────────────────────────────────────────────
-- 2. APPOINTMENTS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Patients can view their own appointments
CREATE POLICY "Patients can view own appointments"
  ON appointments
  FOR SELECT
  USING (
    patient_id IN (
      SELECT p.id
      FROM patients p
      INNER JOIN users u ON u.id = p.user_id
      WHERE u.supabase_id = auth.uid()
    )
  );

-- Doctors can view appointments assigned to them
CREATE POLICY "Doctors can view own appointments"
  ON appointments
  FOR SELECT
  USING (
    doctor_id IN (
      SELECT d.id
      FROM doctors d
      INNER JOIN users u ON u.id = d.user_id
      WHERE u.supabase_id = auth.uid()
    )
  );

-- Admins can view all appointments
CREATE POLICY "Admins can view all appointments"
  ON appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE supabase_id = auth.uid()
        AND role = 'ADMIN'
    )
  );


-- ─────────────────────────────────────────────────────────
-- 3. PRESCRIPTIONS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

-- Patients can view their own prescriptions
CREATE POLICY "Patients can view own prescriptions"
  ON prescriptions
  FOR SELECT
  USING (
    patient_id IN (
      SELECT p.id
      FROM patients p
      INNER JOIN users u ON u.id = p.user_id
      WHERE u.supabase_id = auth.uid()
    )
  );

-- Doctors can view prescriptions they wrote
CREATE POLICY "Doctors can view own prescriptions"
  ON prescriptions
  FOR SELECT
  USING (
    doctor_id IN (
      SELECT d.id
      FROM doctors d
      INNER JOIN users u ON u.id = d.user_id
      WHERE u.supabase_id = auth.uid()
    )
  );

-- Admins can view all prescriptions
CREATE POLICY "Admins can view all prescriptions"
  ON prescriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE supabase_id = auth.uid()
        AND role = 'ADMIN'
    )
  );
