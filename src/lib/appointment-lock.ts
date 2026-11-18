import type { Prisma } from "@prisma/client";

export class AppointmentConflict extends Error {}

/** Transaction-scoped locks use one global order to avoid deadlocks. */
export async function reserveAppointmentSlot(
  tx: Prisma.TransactionClient,
  doctorId: string, patientId: string, start: Date, duration: number
) {
  const keys = [`appointment:doctor:${doctorId}`, `appointment:patient:${patientId}`].sort();
  for (const key of keys) {
    // Cast PostgreSQL's void return type to a Prisma-supported scalar.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }
  const end = new Date(start.getTime() + duration * 60_000);
  // No arbitrary look-back window: existing appointments can have unequal durations.
  const conflicts = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM public.appointments
    WHERE (doctor_id = ${doctorId} OR patient_id = ${patientId})
      AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
      AND scheduled_at < ${end}
      AND scheduled_at + duration * INTERVAL '1 minute' > ${start}
    LIMIT 1`;
  if (conflicts.length) throw new AppointmentConflict("This doctor or patient already has an overlapping appointment");
}
