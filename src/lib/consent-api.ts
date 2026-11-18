import { NextResponse } from "next/server";
import { z } from "zod";
import { ConsentError } from "@/lib/record-access-requests";
export function consentApiError(error: unknown) {
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Check the record scope, duration and verification fields", details: error.issues }, { status: 422 });
  if (error instanceof ConsentError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: "Could not complete the records access request. Try again later." }, { status: 500 });
}
export function effectiveAccessStatus(row: { status: string; expiresAt: Date; revokedAt?: Date | null }) {
  if (row.revokedAt) return "REVOKED";
  return ["PENDING", "APPROVED"].includes(row.status) && row.expiresAt <= new Date() ? "EXPIRED" : row.status;
}
export const consentProviderInclude = {
  requesterDoctor: { select: { id: true, isVerified: true, user: { select: { firstName: true, lastName: true, isActive: true, role: true } } } },
  requesterFacility: { select: { id: true, name: true, isActive: true } },
  sourceDoctor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  sourceFacility: { select: { id: true, name: true } },
} as const;
