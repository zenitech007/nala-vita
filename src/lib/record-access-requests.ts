import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeEmailOtp, issueEmailOtp } from "@/lib/email-otp";
import { sendAppEmail } from "@/lib/otp-channel";
import { RECORD_SCOPES, type ClinicalScope } from "@/lib/record-scope";
import type { RecordViewer } from "@/lib/record-visibility";

export class ConsentError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
type ConsentPatient = RecordViewer & { email: string | null; emailVerified: boolean };
export const approvalChoiceSchema = z.object({ scope: z.array(z.enum(RECORD_SCOPES)).min(1).max(RECORD_SCOPES.length), durationDays: z.number().int().min(1).max(365) });
const canonicalScope = (scope: readonly ClinicalScope[]) => [...new Set(scope)].sort();
const approvalBinding = (requestId: string, choice: z.infer<typeof approvalChoiceSchema>) => JSON.stringify({ requestId, scope: canonicalScope(choice.scope), durationDays: choice.durationDays });

export async function requestRecordAccess(viewer: RecordViewer, input: { patientId: string; scope: ClinicalScope[];
  reason?: string;
  sourceDoctorId?: string | null; sourceFacilityId?: string | null; sourceUserId?: string | null; requesterFacilityId?: string | null }) {
  if (!viewer.isActive || viewer.role !== "DOCTOR" || !viewer.doctor?.isVerified) throw new ConsentError("Forbidden", 403);
  if (!input.scope.length || input.scope.some(scope => !RECORD_SCOPES.includes(scope))) throw new ConsentError("Choose a valid record scope");
  const requesterFacilityId = input.requesterFacilityId || null;
  if (requesterFacilityId && !await prisma.facilityMembership.findFirst({ where: { doctorId: viewer.doctor.id, facilityId: requesterFacilityId, isActive: true, facility: { isActive: true } } })) throw new ConsentError("Forbidden facility", 403);
  const patient = await prisma.patient.findUnique({ where: { id: input.patientId }, select: { id: true, userId: true, user: { select: { id: true, email: true, isActive: true } } } });
  if (!patient?.user.isActive) throw new ConsentError("Patient is not available", 404);
  const sourceDoctorId = input.sourceDoctorId || null, sourceFacilityId = input.sourceFacilityId || null, sourceUserId = input.sourceUserId || null;
  if ([sourceDoctorId, sourceFacilityId, sourceUserId].filter(Boolean).length !== 1 || (sourceUserId && sourceUserId !== patient.userId)) throw new ConsentError("Choose one source provider or the patient's own records");
  if (sourceDoctorId && !await prisma.doctor.findUnique({ where: { id: sourceDoctorId }, select: { id: true } })) throw new ConsentError("Source provider is not available");
  if (sourceFacilityId && !await prisma.facility.findUnique({ where: { id: sourceFacilityId }, select: { id: true } })) throw new ConsentError("Source facility is not available");
  const requesterDoctorId = requesterFacilityId ? null : viewer.doctor.id;
  const tuple = { patientId: patient.id, requesterDoctorId, requesterFacilityId, sourceDoctorId, sourceFacilityId, sourceUserId };
  const result = await prisma.$transaction(async tx => {
    for (const key of [`consent-actor:${viewer.id}`, `consent-request:${JSON.stringify(tuple)}`].sort()) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
    const existing = await tx.recordAccessRequest.findFirst({ where: { ...tuple, status: "PENDING", expiresAt: { gt: new Date() } } });
    if (existing) return { request: existing, created: false };
    if (await tx.recordAccessRequest.count({ where: { requestedByUserId: viewer.id, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= 20) throw new ConsentError("Request limit reached. Try again tomorrow.", 429);
    const request = await tx.recordAccessRequest.create({ data: { ...tuple, requestedByUserId: viewer.id, reason: input.reason?.trim().slice(0, 1000) || null, scope: canonicalScope(input.scope), expiresAt: new Date(Date.now() + 30 * 86400000) } });
    await tx.notification.create({ data: { userId: patient.userId, title: "Record access approval requested", message: "A provider requested access to records. Review the source, scope and duration before approving.", type: "RECORD_ACCESS", link: "/patient/access" } });
    return { request, created: true };
  }, { isolationLevel: "ReadCommitted" });
  if (result.created && patient.user.email) {
    try { await sendAppEmail(patient.user.email, "A provider requested access to your records",
      `Sign in to Nala Vita and open Who has access to review the request. Approval is optional. ${process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/patient/access` : ""}`); }
    catch { console.error("Record-request email delivery unavailable; in-app request is pending"); }
  }
  return { id: result.request.id, status: result.request.status };
}

async function pendingForPatient(viewer: ConsentPatient, requestId: string) {
  if (!viewer.isActive || viewer.role !== "PATIENT" || !viewer.patient) throw new ConsentError("Forbidden", 403);
  const request = await prisma.recordAccessRequest.findFirst({ where: { id: requestId, patientId: viewer.patient.id, status: "PENDING", expiresAt: { gt: new Date() } } });
  if (!request) throw new ConsentError("Pending request not available", 409);
  return request;
}
export async function requestApprovalOtp(viewer: ConsentPatient, requestId: string, rawChoice: unknown, ip: string) {
  if (!viewer.email || !viewer.emailVerified) throw new ConsentError("Verify your email before approving access", 403);
  const choice = approvalChoiceSchema.parse(rawChoice), request = await pendingForPatient(viewer, requestId);
  if (choice.scope.some(scope => !request.scope.includes(scope))) throw new ConsentError("Choose only requested record types");
  return issueEmailOtp({ email: viewer.email, ip, purpose: "RECORD_ACCESS_APPROVAL", targetUserId: viewer.id, verifiedEmail: true,
    binding: approvalBinding(request.id, choice), context: { requestId, scope: canonicalScope(choice.scope), durationDays: choice.durationDays } });
}
export async function approveRecordAccess(viewer: ConsentPatient, requestId: string, rawChoice: unknown,
  proof: { challengeId: string; code: string; ip: string }) {
  if (!viewer.email || !viewer.emailVerified) throw new ConsentError("Verify your email before approving access", 403);
  const choice = approvalChoiceSchema.parse(rawChoice);
  await pendingForPatient(viewer, requestId);
  const result = await consumeEmailOtp({ ...proof, purpose: "RECORD_ACCESS_APPROVAL", binding: approvalBinding(requestId, choice) }, async (tx, challenge) => {
    if (challenge.targetUserId !== viewer.id) return false;
    const request = await tx.recordAccessRequest.findFirst({ where: { id: requestId, patientId: viewer.patient!.id, status: "PENDING", expiresAt: { gt: new Date() } } });
    if (!request || choice.scope.some(scope => !request.scope.includes(scope))) return false;
    const provider = await tx.doctor.findUnique({ where: request.requesterDoctorId ? { id: request.requesterDoctorId } : { userId: request.requestedByUserId }, include: { user: true } });
    if (!provider?.isVerified || !provider.user.isActive || provider.user.role !== "DOCTOR") return false;
    if (request.requesterDoctorId && request.requesterDoctorId !== provider.id) return false;
    if (request.requesterFacilityId && !await tx.facilityMembership.findFirst({ where: { doctorId: provider.id, facilityId: request.requesterFacilityId, isActive: true, facility: { isActive: true } } })) return false;
    const now = new Date();
    const changed = await tx.recordAccessRequest.updateMany({ where: { id: request.id, patientId: viewer.patient!.id, status: "PENDING", expiresAt: { gt: now } }, data: { status: "APPROVED", approvedAt: now } });
    if (changed.count !== 1) return false;
    const grant = await tx.recordAccessGrant.create({ data: { requestId: request.id, patientId: request.patientId, requesterDoctorId: request.requesterDoctorId,
      requesterFacilityId: request.requesterFacilityId, sourceDoctorId: request.sourceDoctorId, sourceFacilityId: request.sourceFacilityId, sourceUserId: request.sourceUserId,
      scope: canonicalScope(choice.scope), status: "APPROVED", approvedAt: now, expiresAt: new Date(now.getTime() + choice.durationDays * 86400000) } });
    await tx.notification.create({ data: { userId: provider.userId, title: "Record access approved", message: "The patient approved scoped access. Review the grant's source and expiry before viewing records.", type: "RECORD_ACCESS", link: "/doctor/record-access" } });
    return { id: grant.id, status: grant.status, expiresAt: grant.expiresAt };
  });
  if (!result) throw new ConsentError("The code or request could not be verified", 400);
  return result;
}
export async function denyRecordAccess(viewer: RecordViewer, requestId: string) {
  if (!viewer.isActive || viewer.role !== "PATIENT" || !viewer.patient) throw new ConsentError("Forbidden", 403);
  const result = await prisma.recordAccessRequest.updateMany({ where: { id: requestId, patientId: viewer.patient.id, status: "PENDING", expiresAt: { gt: new Date() } }, data: { status: "DENIED", deniedAt: new Date() } });
  if (result.count !== 1) throw new ConsentError("Request changed or is unavailable", 409);
}
export async function createPatientRecordRequest(viewer: ConsentPatient, input: { doctorId: string; scope: ClinicalScope[];
  reason?: string;
  sourceDoctorId?: string | null; sourceFacilityId?: string | null; sourceUserId?: string | null }) {
  if (!viewer.isActive || viewer.role !== "PATIENT" || !viewer.patient) throw new ConsentError("Forbidden", 403);
  const doctor = await prisma.doctor.findUnique({ where: { id: input.doctorId }, include: { user: true } });
  if (!doctor?.isVerified || !doctor.user.isActive || doctor.user.role !== "DOCTOR") throw new ConsentError("Provider is not available", 404);
  const sourceDoctorId = input.sourceDoctorId || null, sourceFacilityId = input.sourceFacilityId || null;
  const sourceUserId = input.sourceUserId || (!sourceDoctorId && !sourceFacilityId ? viewer.id : null);
  if ([sourceDoctorId, sourceFacilityId, sourceUserId].filter(Boolean).length !== 1 || (sourceUserId && sourceUserId !== viewer.id)) throw new ConsentError("Choose one record source");
  if (!input.scope.length || input.scope.some(scope => !RECORD_SCOPES.includes(scope))) throw new ConsentError("Choose a valid scope");
  if (sourceDoctorId && !await prisma.doctor.findUnique({ where: { id: sourceDoctorId }, select: { id: true } })) throw new ConsentError("Source provider is unavailable");
  if (sourceFacilityId && !await prisma.facility.findUnique({ where: { id: sourceFacilityId }, select: { id: true } })) throw new ConsentError("Source facility is unavailable");
  return prisma.$transaction(async tx => {
    const key = `patient-share:${viewer.id}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
    const tuple = { patientId: viewer.patient!.id, requesterDoctorId: doctor.id, requesterFacilityId: null, sourceDoctorId, sourceFacilityId, sourceUserId };
    const existing = await tx.recordAccessRequest.findFirst({ where: { ...tuple, status: "PENDING", expiresAt: { gt: new Date() } } });
    if (existing) return { id: existing.id, status: existing.status };
    if (await tx.recordAccessRequest.count({ where: { requestedByUserId: viewer.id, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= 20) throw new ConsentError("Request limit reached", 429);
    const request = await tx.recordAccessRequest.create({ data: { ...tuple, requestedByUserId: viewer.id, reason: input.reason?.trim().slice(0, 1000) || null, scope: canonicalScope(input.scope), expiresAt: new Date(Date.now() + 30 * 86400000) } });
    return { id: request.id, status: request.status };
  });
}
export async function revokeRecordAccess(viewer: RecordViewer, grantId: string) {
  if (!viewer.isActive || viewer.role !== "PATIENT" || !viewer.patient) throw new ConsentError("Forbidden", 403);
  await prisma.$transaction(async tx => {
    const grant = await tx.recordAccessGrant.findFirst({ where: { id: grantId, patientId: viewer.patient!.id, status: "APPROVED", revokedAt: null } });
    if (!grant) throw new ConsentError("Grant not available", 409);
    const now = new Date();
    const changed = await tx.recordAccessGrant.updateMany({ where: { id: grant.id, patientId: viewer.patient!.id, status: "APPROVED", revokedAt: null }, data: { status: "REVOKED", revokedAt: now } });
    if (changed.count !== 1) throw new ConsentError("Grant changed", 409);
    await tx.recordAccessRequest.updateMany({ where: { id: grant.requestId, patientId: viewer.patient!.id, status: "APPROVED" }, data: { status: "REVOKED", revokedAt: now } });
    await tx.recordAccessLog.create({ data: { patientId: viewer.patient!.id, viewerUserId: viewer.id, recordType: "ACCESS_REVOKED", recordId: grant.id, grantId: grant.id } });
  });
}
