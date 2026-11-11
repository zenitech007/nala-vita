-- Legacy reminders remain unscheduled until the user explicitly recreates them in an IANA timezone.
ALTER TABLE users ADD COLUMN time_zone text;
ALTER TABLE reminders ADD COLUMN time_zone text;
ALTER TABLE reminders ADD COLUMN local_hour integer;
ALTER TABLE reminders ADD COLUMN local_minute integer;
ALTER TABLE reminders ADD CONSTRAINT reminder_local_clock_check CHECK (
  (local_hour IS NULL AND local_minute IS NULL) OR
  (local_hour IS NOT NULL AND local_minute IS NOT NULL AND local_hour BETWEEN 0 AND 23 AND local_minute BETWEEN 0 AND 59)
);
-- The existing self-update RLS policy continues to govern this preference column.
GRANT UPDATE (time_zone) ON users TO authenticated;
