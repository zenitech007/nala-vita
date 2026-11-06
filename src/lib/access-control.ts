import { prisma } from "@/lib/prisma";
import { workspacePatientWhere } from "@/lib/record-visibility";
/** Care workspace only. All clinical reads must additionally use record visibility. */
export async function doctorHasPatientAccess(doctorId: string, patientId: string): Promise<boolean> {
  const appointment = await prisma.appointment.findFirst({ where: { doctorId, patientId, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] } }, select: { id: true } });
  if (appointment) return true;
  return !!await prisma.patient.findFirst({ where: { id: patientId, AND: [workspacePatientWhere(doctorId)] }, select: { id: true } });
}
