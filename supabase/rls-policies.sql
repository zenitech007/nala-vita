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
--
-- WARNING: If you re-run this script, existing policies with
-- the same name will cause errors. Drop them first or use
-- CREATE POLICY IF NOT EXISTS (Postgres 16+).
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────
-- Helper: reusable role check function
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE supabase_id = auth.uid() AND role = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM users WHERE supabase_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_patient_id()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT p.id FROM patients p
  INNER JOIN users u ON u.id = p.user_id
  WHERE u.supabase_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION current_doctor_id()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT d.id FROM doctors d
  INNER JOIN users u ON u.id = d.user_id
  WHERE u.supabase_id = auth.uid() LIMIT 1;
$$;


-- ─────────────────────────────────────────────────────────
-- 1. USERS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (supabase_id = auth.uid());

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (is_admin());

-- Users update their own non-sensitive fields (avatar, phone)
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (supabase_id = auth.uid())
  WITH CHECK (supabase_id = auth.uid());

-- Admins can deactivate / change roles
CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  USING (is_admin());


-- ─────────────────────────────────────────────────────────
-- 2. PATIENTS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own record"
  ON patients FOR SELECT
  USING (user_id = current_user_id());

CREATE POLICY "Doctors can view their patients"
  ON patients FOR SELECT
  USING (
    id IN (
      SELECT a.patient_id
      FROM appointments a
      WHERE a.doctor_id = current_doctor_id()
    )
  );

CREATE POLICY "Admins can view all patients"
  ON patients FOR SELECT
  USING (is_admin());

CREATE POLICY "Patients can update own record"
  ON patients FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

CREATE POLICY "Admins can update any patient"
  ON patients FOR UPDATE
  USING (is_admin());


-- ─────────────────────────────────────────────────────────
-- 3. DOCTORS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can browse doctors (needed for appointment booking)
CREATE POLICY "Authenticated users can view verified doctors"
  ON doctors FOR SELECT
  USING (is_verified = true OR user_id = current_user_id() OR is_admin());

CREATE POLICY "Doctors can update own profile"
  ON doctors FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());

-- Only admins can verify doctors
CREATE POLICY "Admins can update any doctor"
  ON doctors FOR UPDATE
  USING (is_admin());


-- ─────────────────────────────────────────────────────────
-- 4. APPOINTMENTS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own appointments"
  ON appointments FOR SELECT
  USING (patient_id = current_patient_id());

CREATE POLICY "Doctors can view own appointments"
  ON appointments FOR SELECT
  USING (doctor_id = current_doctor_id());

CREATE POLICY "Admins can view all appointments"
  ON appointments FOR SELECT
  USING (is_admin());

CREATE POLICY "Patients can create appointments"
  ON appointments FOR INSERT
  WITH CHECK (patient_id = current_patient_id());

CREATE POLICY "Doctors can update appointment status"
  ON appointments FOR UPDATE
  USING (doctor_id = current_doctor_id());

CREATE POLICY "Patients can cancel own appointments"
  ON appointments FOR UPDATE
  USING (patient_id = current_patient_id());

CREATE POLICY "Admins can update any appointment"
  ON appointments FOR UPDATE
  USING (is_admin());


-- ─────────────────────────────────────────────────────────
-- 5. PRESCRIPTIONS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own prescriptions"
  ON prescriptions FOR SELECT
  USING (patient_id = current_patient_id());

CREATE POLICY "Doctors can view own prescriptions"
  ON prescriptions FOR SELECT
  USING (doctor_id = current_doctor_id());

CREATE POLICY "Admins can view all prescriptions"
  ON prescriptions FOR SELECT
  USING (is_admin());

CREATE POLICY "Doctors can create prescriptions"
  ON prescriptions FOR INSERT
  WITH CHECK (doctor_id = current_doctor_id());

CREATE POLICY "Doctors can update own prescriptions"
  ON prescriptions FOR UPDATE
  USING (doctor_id = current_doctor_id());


-- ─────────────────────────────────────────────────────────
-- 6. VITALS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own vitals"
  ON vitals FOR SELECT
  USING (patient_id = current_patient_id());

CREATE POLICY "Doctors can view vitals of their patients"
  ON vitals FOR SELECT
  USING (
    patient_id IN (
      SELECT a.patient_id FROM appointments a
      WHERE a.doctor_id = current_doctor_id()
    )
  );

CREATE POLICY "Admins can view all vitals"
  ON vitals FOR SELECT
  USING (is_admin());

CREATE POLICY "Patients can record own vitals"
  ON vitals FOR INSERT
  WITH CHECK (patient_id = current_patient_id());

-- Vitals are append-only; no update/delete for data integrity


-- ─────────────────────────────────────────────────────────
-- 7. MESSAGES TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  USING (sender_id = current_user_id() OR receiver_id = current_user_id());

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT
  WITH CHECK (sender_id = current_user_id());

CREATE POLICY "Receivers can mark messages as read"
  ON messages FOR UPDATE
  USING (receiver_id = current_user_id())
  WITH CHECK (receiver_id = current_user_id());


-- ─────────────────────────────────────────────────────────
-- 8. NOTIFICATIONS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = current_user_id());

CREATE POLICY "Users can mark own notifications as read"
  ON notifications FOR UPDATE
  USING (user_id = current_user_id())
  WITH CHECK (user_id = current_user_id());


-- ─────────────────────────────────────────────────────────
-- 9. LAB ORDERS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE lab_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own lab orders"
  ON lab_orders FOR SELECT
  USING (patient_id = current_patient_id());

CREATE POLICY "Doctors can view lab orders they created"
  ON lab_orders FOR SELECT
  USING (doctor_id = current_doctor_id());

CREATE POLICY "Admins can view all lab orders"
  ON lab_orders FOR SELECT
  USING (is_admin());

CREATE POLICY "Doctors can create lab orders"
  ON lab_orders FOR INSERT
  WITH CHECK (doctor_id = current_doctor_id());


-- ─────────────────────────────────────────────────────────
-- 10. LAB RESULTS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own lab results"
  ON lab_results FOR SELECT
  USING (
    lab_order_id IN (
      SELECT id FROM lab_orders WHERE patient_id = current_patient_id()
    )
  );

CREATE POLICY "Doctors can view lab results for their orders"
  ON lab_results FOR SELECT
  USING (
    lab_order_id IN (
      SELECT id FROM lab_orders WHERE doctor_id = current_doctor_id()
    )
  );

CREATE POLICY "Admins can view all lab results"
  ON lab_results FOR SELECT
  USING (is_admin());


-- ─────────────────────────────────────────────────────────
-- 11. MEDICAL NOTES TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE medical_notes ENABLE ROW LEVEL SECURITY;

-- Patients can see notes that are not marked private
CREATE POLICY "Patients can view non-private notes"
  ON medical_notes FOR SELECT
  USING (patient_id = current_patient_id() AND is_private = false);

CREATE POLICY "Doctors can view own notes"
  ON medical_notes FOR SELECT
  USING (doctor_id = current_doctor_id());

CREATE POLICY "Admins can view all medical notes"
  ON medical_notes FOR SELECT
  USING (is_admin());

CREATE POLICY "Doctors can create medical notes"
  ON medical_notes FOR INSERT
  WITH CHECK (doctor_id = current_doctor_id());

CREATE POLICY "Doctors can update own notes"
  ON medical_notes FOR UPDATE
  USING (doctor_id = current_doctor_id());


-- ─────────────────────────────────────────────────────────
-- 12. REFERRALS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own referrals"
  ON referrals FOR SELECT
  USING (patient_id = current_patient_id());

CREATE POLICY "Referring doctor can view own referrals"
  ON referrals FOR SELECT
  USING (referring_doctor_id = current_doctor_id());

CREATE POLICY "Referred doctor can view incoming referrals"
  ON referrals FOR SELECT
  USING (referred_doctor_id = current_doctor_id());

CREATE POLICY "Admins can view all referrals"
  ON referrals FOR SELECT
  USING (is_admin());

CREATE POLICY "Referring doctor can create referrals"
  ON referrals FOR INSERT
  WITH CHECK (referring_doctor_id = current_doctor_id());

CREATE POLICY "Referred doctor can update referral status"
  ON referrals FOR UPDATE
  USING (referred_doctor_id = current_doctor_id());


-- ─────────────────────────────────────────────────────────
-- 13. PAYMENTS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own payments"
  ON payments FOR SELECT
  USING (patient_id = current_patient_id());

CREATE POLICY "Doctors can view payments for their appointments"
  ON payments FOR SELECT
  USING (
    appointment_id IN (
      SELECT id FROM appointments WHERE doctor_id = current_doctor_id()
    )
  );

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (is_admin());

-- Payments are created and updated only by the service role (Stripe webhook)
-- No direct client INSERT/UPDATE allowed


-- ─────────────────────────────────────────────────────────
-- 14. FILE UPLOADS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own file uploads"
  ON file_uploads FOR SELECT
  USING (user_id = current_user_id());

CREATE POLICY "Admins can view all file uploads"
  ON file_uploads FOR SELECT
  USING (is_admin());

CREATE POLICY "Users can create own file uploads"
  ON file_uploads FOR INSERT
  WITH CHECK (user_id = current_user_id());


-- ─────────────────────────────────────────────────────────
-- 15. AUDIT LOGS TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs are strictly admin-only and append-only
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_admin());

-- No client-side INSERT/UPDATE/DELETE on audit logs
-- (all writes go through the service role via logAudit())


-- ─────────────────────────────────────────────────────────
-- 16. BED RESOURCES TABLE
-- ─────────────────────────────────────────────────────────

ALTER TABLE bed_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and doctors can view bed resources"
  ON bed_resources FOR SELECT
  USING (is_admin() OR current_doctor_id() IS NOT NULL);

CREATE POLICY "Admins can manage bed resources"
  ON bed_resources FOR ALL
  USING (is_admin());
