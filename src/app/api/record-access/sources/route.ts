import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consentApiError } from "@/lib/consent-api";
export async function GET() {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  try {
    const patientId = auth.user.patient!.id;
    const select = { authoredByDoctorId: true, authoredByFacilityId: true, authoredByUserId: true } as const;
    const rows = (await Promise.all([
      prisma.prescription.findMany({ where: { patientId }, select }), prisma.vital.findMany({ where: { patientId }, select }),
      prisma.medicalNote.findMany({ where: { patientId }, select }), prisma.labOrder.findMany({ where: { patientId }, select }),
      prisma.appointment.findMany({ where: { patientId }, select }), prisma.referral.findMany({ where: { patientId }, select }),
    ])).flat();
    const doctorIds = [...new Set([...rows.map(row => row.authoredByDoctorId), auth.user.patient!.createdByDoctorId].filter((id): id is string => !!id))];
    const facilityIds = [...new Set([...rows.map(row => row.authoredByFacilityId), auth.user.patient!.createdByFacilityId].filter((id): id is string => !!id))];
    const [doctors, facilities] = await Promise.all([
      prisma.doctor.findMany({ where: { id: { in: doctorIds } }, select: { id: true, user: { select: { firstName: true, lastName: true } } } }),
      prisma.facility.findMany({ where: { id: { in: facilityIds } }, select: { id: true, name: true } }),
    ]);
    return NextResponse.json({ sources: [
      { key: `user:${auth.user.id}`, label: "Records you entered and your profile", sourceUserId: auth.user.id },
      ...doctors.map(doctor => ({ key: `doctor:${doctor.id}`, label: `Dr. ${doctor.user.firstName} ${doctor.user.lastName}`, sourceDoctorId: doctor.id })),
      ...facilities.map(facility => ({ key: `facility:${facility.id}`, label: facility.name, sourceFacilityId: facility.id })),
    ], hasUnclassifiedRecords: rows.some(row => !row.authoredByDoctorId && !row.authoredByFacilityId && !row.authoredByUserId) });
  } catch (error) { return consentApiError(error); }
}
