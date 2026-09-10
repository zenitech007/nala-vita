import { prisma } from "@/lib/prisma";

const CARE_APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

/**
 * A doctor may act on a patient only when a care relationship exists through
 * a non-cancelled appointment or an accepted referral in either direction.
 */
export async function doctorHasPatientAccess(
  doctorId: string,
  patientId: string
): Promise<boolean> {
  const [appointment, referral] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        doctorId,
        patientId,
        status: { in: [...CARE_APPOINTMENT_STATUSES] },
      },
      select: { id: true },
    }),
    prisma.referral.findFirst({
      where: {
        patientId,
        status: "ACCEPTED",
        OR: [{ referringDoctorId: doctorId }, { referredDoctorId: doctorId }],
      },
      select: { id: true },
    }),
  ]);

  return Boolean(appointment || referral);
}

