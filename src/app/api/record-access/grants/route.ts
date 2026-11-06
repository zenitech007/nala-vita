import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consentApiError, consentProviderInclude, effectiveAccessStatus } from "@/lib/consent-api";
export async function GET() {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  try {
    const grants = await prisma.recordAccessGrant.findMany({ where: { patientId: auth.user.patient!.id }, include: consentProviderInclude, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ grants: grants.map(grant => ({ ...grant, effectiveStatus: effectiveAccessStatus(grant) })) });
  } catch (error) { return consentApiError(error); }
}
