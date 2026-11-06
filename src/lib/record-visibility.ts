import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ClinicalScope } from "@/lib/record-scope";

export interface RecordViewer {
  id: string; role: string; isActive: boolean;
  patient?: { id: string } | null;
  doctor?: { id: string; isVerified: boolean } | null;
}
type AuthoredRecord = { id: string; authoredByDoctorId?: string | null; authoredByFacilityId?: string | null; authoredByUserId?: string | null };
interface SourceFilter {
  authoredByDoctorId?: string;
  authoredByFacilityId?: string | { in: string[] };
  authoredByUserId?: string;
  isPrivate?: boolean; isSharedWithDoctor?: boolean;
  patient?: { is: Prisma.PatientWhereInput };
}
export interface ClinicalRecordFilter {
  patientId: string; OR?: SourceFilter[]; isPrivate?: boolean;
}
export class RecordAccessDenied extends Error {}

/** Sole clinical visibility policy: self, own authorship, or an active scoped source grant. */
export async function getRecordVisibility(viewer: RecordViewer, patientId: string) {
  if (!viewer.isActive) throw new RecordAccessDenied("Inactive account");
  const self = viewer.role === "PATIENT" && viewer.patient?.id === patientId;
  const doctor = viewer.role === "DOCTOR" && viewer.doctor?.isVerified ? viewer.doctor : null;
  if (!self && !doctor) throw new RecordAccessDenied("Forbidden");
  const target = await prisma.patient.findUnique({ where: { id: patientId }, select: { userId: true, createdByDoctorId: true, createdByFacilityId: true } });
  if (!target || (self && target.userId !== viewer.id)) throw new RecordAccessDenied("Patient not available");
  const memberships = doctor ? await prisma.facilityMembership.findMany({ where: { doctorId: doctor.id, isActive: true, facility: { isActive: true } }, include: { facility: { select: { isActive: true } } } }) : [];
  const facilityIds = memberships.filter(member => member.isActive && member.facility.isActive).map(member => member.facilityId);
  const now = new Date();
  const grants = doctor ? await prisma.recordAccessGrant.findMany({ where: { patientId, status: "APPROVED", revokedAt: null, expiresAt: { gt: now },
    OR: [{ requesterDoctorId: doctor.id }, { requesterFacilityId: { in: facilityIds } }] } }) : [];
  const active = grants.filter(grant => grant.patientId === patientId && grant.status === "APPROVED" && !grant.revokedAt && grant.expiresAt > now
    && [grant.requesterDoctorId, grant.requesterFacilityId].filter(Boolean).length === 1
    && [grant.sourceDoctorId, grant.sourceFacilityId, grant.sourceUserId].filter(Boolean).length === 1
    && (grant.requesterDoctorId === doctor?.id || (grant.requesterFacilityId && facilityIds.includes(grant.requesterFacilityId)))
    && (!grant.sourceUserId || grant.sourceUserId === target.userId));
  const liveGrant = (id: string): Prisma.RecordAccessGrantWhereInput => ({ id, status: "APPROVED", revokedAt: null, expiresAt: { gt: new Date() }, OR: [
    { requesterDoctorId: doctor!.id },
    { requesterFacility: { is: { isActive: true, memberships: { some: { doctorId: doctor!.id, isActive: true } } } } },
  ] });
  const grantSource = (grant: typeof active[number]): SourceFilter => grant.sourceDoctorId ? { authoredByDoctorId: grant.sourceDoctorId }
    : grant.sourceFacilityId ? { authoredByFacilityId: grant.sourceFacilityId } : { authoredByUserId: grant.sourceUserId! };
  const profileGrants = active.filter(grant => grant.scope.includes("PROFILE") && (grant.sourceUserId === target.userId
    || (grant.sourceDoctorId && grant.sourceDoctorId === target.createdByDoctorId) || (grant.sourceFacilityId && grant.sourceFacilityId === target.createdByFacilityId)));
  const ownsProfile = !!doctor && (target.createdByDoctorId === doctor.id || (!!target.createdByFacilityId && facilityIds.includes(target.createdByFacilityId)));
  const profileWhere: Prisma.PatientWhereInput = self ? { id: patientId } : { id: patientId, OR: [
    ...(ownsProfile ? [{ createdByDoctorId: doctor!.id }, ...(facilityIds.length ? [{ createdByFacilityId: { in: facilityIds } }] : [])] : []),
    ...profileGrants.map(grant => ({ recordAccessGrants: { some: liveGrant(grant.id) } })),
  ] };

  return {
    patientId, facilityIds, profileWhere, canReadProfile: self || ownsProfile || profileGrants.length > 0,
    where(scope: ClinicalScope): ClinicalRecordFilter {
      if (self) return { patientId };
      const own: SourceFilter[] = [{ authoredByDoctorId: doctor!.id }, ...(facilityIds.length ? [{ authoredByFacilityId: { in: facilityIds },
        ...(scope === "NOTES" ? { isPrivate: false } : {}), ...(scope === "PRESCRIPTIONS" ? { isSharedWithDoctor: true } : {}),
      }] : [])];
      const shared = active.filter(grant => grant.scope.includes(scope)).map(grant => ({ ...grantSource(grant),
        patient: { is: { recordAccessGrants: { some: liveGrant(grant.id) } } },
        ...(scope === "NOTES" ? { isPrivate: false } : {}), ...(scope === "PRESCRIPTIONS" ? { isSharedWithDoctor: true } : {}),
      }));
      return { patientId, OR: [...own, ...shared] };
    },
    async log(recordType: ClinicalScope | "LAB_RESULT", records: readonly AuthoredRecord[]) {
      if (!doctor || !records.length) return;
      await prisma.recordAccessLog.createMany({ data: records.map(record => {
        const own = record.authoredByDoctorId === doctor.id || (!!record.authoredByFacilityId && facilityIds.includes(record.authoredByFacilityId));
        const grant = own ? null : active.find(item => item.scope.includes(recordType === "LAB_RESULT" ? "LAB_TESTS" : recordType)
          && ((item.sourceDoctorId && item.sourceDoctorId === record.authoredByDoctorId)
            || (item.sourceFacilityId && item.sourceFacilityId === record.authoredByFacilityId)
            || (item.sourceUserId && item.sourceUserId === record.authoredByUserId)));
        return { patientId, viewerUserId: viewer.id, viewerDoctorId: doctor.id,
          viewerFacilityId: grant?.requesterFacilityId ?? (record.authoredByFacilityId && facilityIds.includes(record.authoredByFacilityId) ? record.authoredByFacilityId : null),
          recordType, recordId: record.id, grantId: grant?.id ?? null };
      }) });
    },
  };
}
