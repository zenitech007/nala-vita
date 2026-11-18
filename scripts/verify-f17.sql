-- READ ONLY. Run on the explicitly selected project before and after F17.
-- Before: all 34 indexes and three columns should be MISSING, with a reconciled baseline.
-- PRESENT or CONFLICT before applying requires manual migration-history reconciliation.
-- After: all should be PRESENT and doctor_id should have is_nullable = YES.
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
SELECT e.index_name, e.table_name, e.columns, a.index_name AS existing_index,
       CASE WHEN a.indexrelid IS NULL THEN 'MISSING'
            WHEN a.index_name = e.index_name AND a.table_name = e.table_name AND a.columns = e.columns
              AND a.indisvalid AND a.indisready AND NOT a.indisunique AND a.amname = 'btree'
              AND a.unfiltered AND a.simple AND a.no_included_columns THEN 'PRESENT'
            ELSE 'CONFLICT' END AS status
FROM expected e LEFT JOIN actual a
  ON a.index_name = e.index_name OR (a.table_name = e.table_name AND a.columns = e.columns)
ORDER BY e.table_name, e.index_name;

WITH expected(column_name, udt_name, nullable) AS (VALUES
 ('added_by','text','NO'), ('is_shared_with_doctor','bool','NO'), ('usage_logs','_text','YES')
)
SELECT e.column_name, c.udt_name, c.is_nullable, c.column_default,
  CASE WHEN c.column_name IS NULL THEN 'MISSING'
       WHEN c.udt_name = e.udt_name AND c.is_nullable = e.nullable
       AND ((e.column_name = 'added_by' AND c.column_default = '''DOCTOR''::text')
         OR (e.column_name = 'is_shared_with_doctor' AND c.column_default = 'true')
         OR (e.column_name = 'usage_logs' AND c.column_default IN ('ARRAY[]::text[]', '''{}''::text[]')))
       THEN 'PRESENT' ELSE 'CONFLICT' END AS status
FROM expected e LEFT JOIN information_schema.columns c
 ON c.table_schema = 'public' AND c.table_name = 'prescriptions' AND c.column_name = e.column_name;

SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'prescriptions' AND column_name = 'doctor_id';

SELECT table_schema, table_name FROM information_schema.tables
WHERE table_name IN ('_prisma_migrations','schema_migrations')
ORDER BY table_schema, table_name;
