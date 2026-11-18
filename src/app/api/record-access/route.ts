import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RECORD_SCOPES } from "@/lib/record-scope";
import { requestRecordAccess, ConsentError } from "@/lib/record-access-requests";
import { consentApiError, consentProviderInclude, effectiveAccessStatus } from "@/lib/consent-api";
export async function GET(req: NextRequest) {
  const auth = await requireApiUser({ roles: ["PATIENT", "DOCTOR"] });
  if (!auth.ok) return auth.response;
  try {
    const memberships = auth.user.doctor ? await prisma.facilityMembership.findMany({ where: { doctorId: auth.user.doctor.id, isActive: true, facility: { isActive: true } }, select: { facilityId: true } }) : [];
    const where = auth.user.role === "PATIENT" && auth.user.patient ? { patientId: auth.user.patient.id, status: "PENDING" as const, expiresAt: { gt: new Date() } }
      : auth.user.doctor ? { OR: [{ requesterDoctorId: auth.user.doctor.id }, { requesterFacilityId: { in: memberships.map(item => item.facilityId) } }] } : null;
    if (!where) throw new ConsentError("Required profile not found", 403);
    const cursor = new URL(req.url).searchParams.get("cursor");
    if (cursor && !await prisma.recordAccessRequest.findFirst({ where: { AND: [where, { id: cursor }] }, select: { id: true } })) throw new ConsentError("Request page is unavailable");
    const requests = await prisma.recordAccessRequest.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { ...consentProviderInclude, grant: true, requestedBy: { select: { firstName: true, lastName: true, role: true } }, patient: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } } });
    return NextResponse.json({ requests: requests.map(request => ({ ...request, scope: request.grant?.scope ?? request.scope,
      expiresAt: request.grant?.expiresAt ?? request.expiresAt, effectiveStatus: effectiveAccessStatus(request.grant ?? request),
      ...(auth.user.role === "DOCTOR" && !request.grant ? { sourceDoctorId: null, sourceFacilityId: null, sourceUserId: null,
        sourceDoctor: null, sourceFacility: null, reason: null, sourcePending: true } : {}),
    })), nextCursor: requests.length === 100 ? requests[requests.length - 1].id : null });
  } catch (error) { return consentApiError(error); }
}
const createSchema = z.object({ patientId: z.string().min(1).optional(), patientEmail: z.string().trim().email().optional(),
  reason: z.string().trim().max(1000).optional(),
  requesterFacilityId: z.string().min(1).optional(), sourceDoctorId: z.string().min(1).optional(), sourceFacilityId: z.string().min(1).optional(),
  sourceUserId: z.string().min(1).optional(), scope: z.array(z.enum(RECORD_SCOPES)).min(1).default([...RECORD_SCOPES]),
}).refine(value => !!value.patientId !== !!value.patientEmail, "Choose a patient ID or email");
export async function POST(req: NextRequest) {
  const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
  if (!auth.ok) return auth.response;
  try {
    const body = createSchema.parse(await req.json());
    const matches = body.patientId ? [await prisma.patient.findUnique({ where: { id: body.patientId }, select: { id: true, userId: true, createdByDoctorId: true, createdByFacilityId: true } })]
      : await prisma.patient.findMany({ where: { user: { email: { equals: body.patientEmail, mode: "insensitive" } } }, take: 2,
        select: { id: true, userId: true, createdByDoctorId: true, createdByFacilityId: true } });
    const patient = matches.length === 1 ? matches[0] : null;
    if (!patient) throw new ConsentError("No eligible record found. Contact the patient or use clinic intake.", 404);
    const specifiedSource = body.sourceDoctorId || body.sourceFacilityId || body.sourceUserId;
    const source = specifiedSource ? { sourceDoctorId: body.sourceDoctorId, sourceFacilityId: body.sourceFacilityId, sourceUserId: body.sourceUserId }
      : patient.createdByFacilityId ? { sourceFacilityId: patient.createdByFacilityId }
        : patient.createdByDoctorId ? { sourceDoctorId: patient.createdByDoctorId } : { sourceUserId: patient.userId };
    const request = await requestRecordAccess(auth.user, { ...body, ...source, patientId: patient.id });
    return NextResponse.json({ request, message: "Patient approval requested. Records remain private until approved." }, { status: 202 });
  } catch (error) { return consentApiError(error); }
}
