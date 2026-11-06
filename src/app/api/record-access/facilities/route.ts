import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consentApiError } from "@/lib/consent-api";
export async function GET() {
  const auth = await requireApiUser({ roles: ["DOCTOR"], profile: "doctor" });
  if (!auth.ok) return auth.response;
  try {
    const memberships = await prisma.facilityMembership.findMany({ where: { doctorId: auth.user.doctor!.id, isActive: true, facility: { isActive: true } }, include: { facility: { select: { id: true, name: true } } } });
    const sources = await prisma.facility.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    return NextResponse.json({ requesterFacilities: memberships.map(row => row.facility), sourceFacilities: sources });
  } catch (error) { return consentApiError(error); }
}
