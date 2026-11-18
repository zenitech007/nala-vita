-- SELECT only. Counts, never patient identifiers or appointment content.
SELECT
  count(*) FILTER (WHERE a.doctor_id = b.doctor_id) AS doctor_overlap_pairs,
  count(*) FILTER (WHERE a.patient_id = b.patient_id) AS patient_overlap_pairs
FROM public.appointments a JOIN public.appointments b ON a.id < b.id
 AND (a.doctor_id = b.doctor_id OR a.patient_id = b.patient_id)
 AND a.scheduled_at < b.scheduled_at + b.duration * INTERVAL '1 minute'
 AND b.scheduled_at < a.scheduled_at + a.duration * INTERVAL '1 minute'
WHERE a.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
  AND b.status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS');

SELECT count(*) AS invalid_duration_count FROM public.appointments WHERE duration NOT BETWEEN 15 AND 120;

SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid = 'public.appointments'::regclass
  AND conname IN ('appointments_duration_range', 'appointments_no_doctor_overlap', 'appointments_no_patient_overlap');
