import { labResultVisibilityWhere } from "@/lib/record-visibility";
import { prisma } from '@/lib/prisma';
import { getRecordVisibility, type RecordViewer } from '@/lib/record-visibility';

const names = { firstName: true, lastName: true, avatarUrl: true } as const;
const clinician = { include: { user: { select: names } } } as const;

/** Shared EHR/context/export loader. Empty collections mean unavailable, not absence of disease. */
export async function loadVisiblePatientRecord(viewer: RecordViewer, patientId: string) {
  const access = await getRecordVisibility(viewer, patientId);
  const [identity, profile, vitals, prescriptions, labOrders, medicalNotes, referrals, appointments] = await Promise.all([
    prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, user: { select: names } } }),
    prisma.patient.findFirst({ where: access.profileWhere, include: { user: { select: { ...names, email: true, phone: true } } } }),
    prisma.vital.findMany({ where: access.where('VITALS'), orderBy: { recordedAt: 'desc' }, take: 100 }),
    prisma.prescription.findMany({ where: access.where('PRESCRIPTIONS'), orderBy: { prescribedAt: 'desc' }, include: { doctor: clinician } }),
    prisma.labOrder.findMany({ where: access.where('LAB_TESTS'), orderBy: { orderedAt: 'desc' }, include: { doctor: clinician, results: { where: labResultVisibilityWhere(access.where('LAB_TESTS')) } } }),
    prisma.medicalNote.findMany({ where: access.where('NOTES'), orderBy: { createdAt: 'desc' }, include: { doctor: clinician } }),
    prisma.referral.findMany({ where: access.where('REFERRALS'), orderBy: { createdAt: 'desc' }, include: { referringDoctor: clinician, referredDoctor: clinician } }),
    prisma.appointment.findMany({ where: access.where('APPOINTMENTS'), orderBy: { scheduledAt: 'desc' }, include: { doctor: clinician } }),
  ]);
  if (!identity) throw new Error('Patient not found');
  await Promise.all([
    access.log('VITALS', vitals), access.log('PRESCRIPTIONS', prescriptions), access.log('LAB_TESTS', labOrders),
    access.log('LAB_RESULT', labOrders.flatMap(order => order.results)), access.log('NOTES', medicalNotes),
    access.log('REFERRALS', referrals), access.log('APPOINTMENTS', appointments),
    ...(profile ? [access.log('PROFILE', [{ id: patientId, authoredByDoctorId: profile.createdByDoctorId, authoredByFacilityId: profile.createdByFacilityId, authoredByUserId: profile.userId }])] : []),
  ]);
  const patient = profile ? { ...profile, insuranceNumber: profile.insuranceNumber ? '****' + profile.insuranceNumber.slice(-4) : null }
    : { ...identity, dateOfBirth: null, gender: null, bloodType: null, allergies: [], address: null, emergencyName: null, emergencyPhone: null, insuranceProvider: null, insuranceNumber: null };
  return { patient, vitals, prescriptions, labOrders, medicalNotes, referrals, appointments,
    accessLimited: viewer.role !== 'PATIENT', profileAvailable: !!profile };
}
