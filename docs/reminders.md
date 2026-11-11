# Reminder delivery

Apply the written reminder migration after the baseline and existing audit migrations in a disposable database first. No migration was applied by the agent.

Users must explicitly save an IANA timezone in Settings before creating reminders. The reminder snapshots that timezone and local clock time. Changing the profile does not move existing reminders. Existing rows without a timezone remain visible with a recreation notice and are excluded from delivery. No timezone is inferred for legacy data.

Configure an external scheduler to GET /api/internal/reminders every minute with Authorization: Bearer followed by CRON_SECRET. Use a random secret of at least 32 characters. No hosted scheduler was configured. A successful response contains a delivered count. Retry a 503. Monitor the structured reminder.worker_failed event. The endpoint processes at most 100 jobs per call, so schedule additional calls if backlog grows.

Each job advances its exact due timestamp with a conditional update and creates a notification in the same transaction. A failed notification rolls back advancement. Deterministic notification IDs and duplicate suppression protect retry delivery. Cancellation and concurrent workers compete on the active flag and due timestamp. Tests mock transactions. Actual PostgreSQL locking and rollback require disposable integration verification.

Daily repeats preserve local clock time across DST. A nonexistent local time during spring-forward is skipped for that day. Repeated local times during fall-back deliver once per local date. Late processing coalesces missed occurrences into one notification and schedules the next future day.

Delivery means an in-app notification. Email and SMS delivery are outside this worker's scope.
