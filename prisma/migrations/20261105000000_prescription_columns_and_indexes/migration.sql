-- F17: apply only after the authoritative database/history is reconciled.
-- A separate SELECT-only inventory is in scripts/verify-f17.sql.
-- Reject out-of-band objects instead of duplicating them or trusting IF NOT EXISTS.
BEGIN;
SET LOCAL search_path = public, pg_catalog;
DO $preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
    AND table_name = 'prescriptions' AND column_name IN ('added_by', 'is_shared_with_doctor', 'usage_logs')) THEN
    RAISE EXCEPTION 'F17: prescription columns already exist; reconcile out-of-band DDL before applying';
  END IF;
  IF EXISTS (
    WITH expected(index_name, table_name, columns) AS (VALUES
    ('doctors_is_verified_rating_idx', 'doctors', ARRAY['is_verified', 'rating']::text[]),
    ('doctors_is_verified_specialization_rating_idx', 'doctors', ARRAY['is_verified', 'specialization', 'rating']::text[]),
    ('appointments_patient_id_status_scheduled_at_idx', 'appointments', ARRAY['patient_id', 'status', 'scheduled_at']::text[]),
    ('appointments_doctor_id_status_scheduled_at_idx', 'appointments', ARRAY['doctor_id', 'status', 'scheduled_at']::text[]),
    ('appointments_doctor_id_patient_id_idx', 'appointments', ARRAY['doctor_id', 'patient_id']::text[]),
    ('prescriptions_patient_id_is_active_prescribed_at_idx', 'prescriptions', ARRAY['patient_id', 'is_active', 'prescribed_at']::text[]),
    ('prescriptions_doctor_id_prescribed_at_idx', 'prescriptions', ARRAY['doctor_id', 'prescribed_at']::text[]),
    ('prescriptions_patient_id_is_shared_with_doctor_idx', 'prescriptions', ARRAY['patient_id', 'is_shared_with_doctor']::text[]),
    ('vitals_patient_id_recorded_at_idx', 'vitals', ARRAY['patient_id', 'recorded_at']::text[]),
    ('lab_orders_patient_id_ordered_at_idx', 'lab_orders', ARRAY['patient_id', 'ordered_at']::text[]),
    ('lab_orders_doctor_id_ordered_at_idx', 'lab_orders', ARRAY['doctor_id', 'ordered_at']::text[]),
    ('lab_results_lab_order_id_completed_at_idx', 'lab_results', ARRAY['lab_order_id', 'completed_at']::text[]),
    ('medical_notes_patient_id_is_private_created_at_idx', 'medical_notes', ARRAY['patient_id', 'is_private', 'created_at']::text[]),
    ('medical_notes_patient_id_category_created_at_idx', 'medical_notes', ARRAY['patient_id', 'category', 'created_at']::text[]),
    ('medical_notes_doctor_id_created_at_idx', 'medical_notes', ARRAY['doctor_id', 'created_at']::text[]),
    ('messages_sender_id_receiver_id_created_at_idx', 'messages', ARRAY['sender_id', 'receiver_id', 'created_at']::text[]),
    ('messages_receiver_id_sender_id_created_at_idx', 'messages', ARRAY['receiver_id', 'sender_id', 'created_at']::text[]),
    ('messages_receiver_id_is_read_idx', 'messages', ARRAY['receiver_id', 'is_read']::text[]),
    ('referrals_patient_id_created_at_idx', 'referrals', ARRAY['patient_id', 'created_at']::text[]),
    ('referrals_referring_doctor_id_created_at_idx', 'referrals', ARRAY['referring_doctor_id', 'created_at']::text[]),
    ('referrals_referred_doctor_id_status_created_at_idx', 'referrals', ARRAY['referred_doctor_id', 'status', 'created_at']::text[]),
    ('payments_patient_id_created_at_idx', 'payments', ARRAY['patient_id', 'created_at']::text[]),
    ('payments_paystack_reference_idx', 'payments', ARRAY['paystack_reference']::text[]),
    ('payments_status_paid_at_idx', 'payments', ARRAY['status', 'paid_at']::text[]),
    ('notifications_user_id_created_at_idx', 'notifications', ARRAY['user_id', 'created_at']::text[]),
    ('notifications_user_id_is_read_created_at_idx', 'notifications', ARRAY['user_id', 'is_read', 'created_at']::text[]),
    ('bed_resources_ward_is_occupied_idx', 'bed_resources', ARRAY['ward', 'is_occupied']::text[]),
    ('file_uploads_user_id_created_at_idx', 'file_uploads', ARRAY['user_id', 'created_at']::text[]),
    ('amelia_conversations_patient_id_updated_at_idx', 'amelia_conversations', ARRAY['patient_id', 'updated_at']::text[]),
    ('amelia_conversations_doctor_id_updated_at_idx', 'amelia_conversations', ARRAY['doctor_id', 'updated_at']::text[]),
    ('amelia_messages_conversation_id_created_at_idx', 'amelia_messages', ARRAY['conversation_id', 'created_at']::text[]),
    ('amelia_memories_patient_id_created_at_idx', 'amelia_memories', ARRAY['patient_id', 'created_at']::text[]),
    ('amelia_memories_patient_id_kind_created_at_idx', 'amelia_memories', ARRAY['patient_id', 'kind', 'created_at']::text[]),
    ('reminders_patient_id_active_next_fire_at_idx', 'reminders', ARRAY['patient_id', 'active', 'next_fire_at']::text[])
    ), actual AS (SELECT i.indexrelid, ci.relname AS index_name, ct.relname AS table_name,
       i.indisvalid, i.indisready, i.indisunique, am.amname,
       i.indpred IS NULL AS unfiltered, i.indexprs IS NULL AS simple,
       i.indnkeyatts = i.indnatts AS no_included_columns,
       ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
             ORDER BY k.ord) AS columns
FROM pg_index i
JOIN pg_class ci ON ci.oid = i.indexrelid
JOIN pg_class ct ON ct.oid = i.indrelid
JOIN pg_namespace n ON n.oid = ct.relnamespace
JOIN pg_am am ON am.oid = ci.relam
WHERE n.nspname = 'public')
    SELECT 1 FROM expected e JOIN actual a
      ON a.index_name = e.index_name OR (a.table_name = e.table_name AND a.columns = e.columns)
  ) THEN
    RAISE EXCEPTION 'F17: an expected/equivalent index already exists; reconcile out-of-band DDL before applying';
  END IF;
END
$preflight$;

ALTER TABLE "prescriptions"
  ADD COLUMN "added_by" TEXT NOT NULL DEFAULT 'DOCTOR',
  ADD COLUMN "is_shared_with_doctor" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "usage_logs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "doctor_id" DROP NOT NULL;

CREATE INDEX "doctors_is_verified_rating_idx" ON "doctors"("is_verified", "rating");

CREATE INDEX "doctors_is_verified_specialization_rating_idx" ON "doctors"("is_verified", "specialization", "rating");

CREATE INDEX "appointments_patient_id_status_scheduled_at_idx" ON "appointments"("patient_id", "status", "scheduled_at");

CREATE INDEX "appointments_doctor_id_status_scheduled_at_idx" ON "appointments"("doctor_id", "status", "scheduled_at");

CREATE INDEX "appointments_doctor_id_patient_id_idx" ON "appointments"("doctor_id", "patient_id");

CREATE INDEX "prescriptions_patient_id_is_active_prescribed_at_idx" ON "prescriptions"("patient_id", "is_active", "prescribed_at");

CREATE INDEX "prescriptions_doctor_id_prescribed_at_idx" ON "prescriptions"("doctor_id", "prescribed_at");

CREATE INDEX "prescriptions_patient_id_is_shared_with_doctor_idx" ON "prescriptions"("patient_id", "is_shared_with_doctor");

CREATE INDEX "vitals_patient_id_recorded_at_idx" ON "vitals"("patient_id", "recorded_at");

CREATE INDEX "lab_orders_patient_id_ordered_at_idx" ON "lab_orders"("patient_id", "ordered_at");

CREATE INDEX "lab_orders_doctor_id_ordered_at_idx" ON "lab_orders"("doctor_id", "ordered_at");

CREATE INDEX "lab_results_lab_order_id_completed_at_idx" ON "lab_results"("lab_order_id", "completed_at");

CREATE INDEX "medical_notes_patient_id_is_private_created_at_idx" ON "medical_notes"("patient_id", "is_private", "created_at");

CREATE INDEX "medical_notes_patient_id_category_created_at_idx" ON "medical_notes"("patient_id", "category", "created_at");

CREATE INDEX "medical_notes_doctor_id_created_at_idx" ON "medical_notes"("doctor_id", "created_at");

CREATE INDEX "messages_sender_id_receiver_id_created_at_idx" ON "messages"("sender_id", "receiver_id", "created_at");

CREATE INDEX "messages_receiver_id_sender_id_created_at_idx" ON "messages"("receiver_id", "sender_id", "created_at");

CREATE INDEX "messages_receiver_id_is_read_idx" ON "messages"("receiver_id", "is_read");

CREATE INDEX "referrals_patient_id_created_at_idx" ON "referrals"("patient_id", "created_at");

CREATE INDEX "referrals_referring_doctor_id_created_at_idx" ON "referrals"("referring_doctor_id", "created_at");

CREATE INDEX "referrals_referred_doctor_id_status_created_at_idx" ON "referrals"("referred_doctor_id", "status", "created_at");

CREATE INDEX "payments_patient_id_created_at_idx" ON "payments"("patient_id", "created_at");

CREATE INDEX "payments_paystack_reference_idx" ON "payments"("paystack_reference");

CREATE INDEX "payments_status_paid_at_idx" ON "payments"("status", "paid_at");

CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

CREATE INDEX "bed_resources_ward_is_occupied_idx" ON "bed_resources"("ward", "is_occupied");

CREATE INDEX "file_uploads_user_id_created_at_idx" ON "file_uploads"("user_id", "created_at");

CREATE INDEX "amelia_conversations_patient_id_updated_at_idx" ON "amelia_conversations"("patient_id", "updated_at");

CREATE INDEX "amelia_conversations_doctor_id_updated_at_idx" ON "amelia_conversations"("doctor_id", "updated_at");

CREATE INDEX "amelia_messages_conversation_id_created_at_idx" ON "amelia_messages"("conversation_id", "created_at");

CREATE INDEX "amelia_memories_patient_id_created_at_idx" ON "amelia_memories"("patient_id", "created_at");

CREATE INDEX "amelia_memories_patient_id_kind_created_at_idx" ON "amelia_memories"("patient_id", "kind", "created_at");

CREATE INDEX "reminders_patient_id_active_next_fire_at_idx" ON "reminders"("patient_id", "active", "next_fire_at");

COMMIT;
