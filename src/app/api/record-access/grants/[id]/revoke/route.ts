import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { revokeRecordAccess } from "@/lib/record-access-requests";
import { consentApiError } from "@/lib/consent-api";
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  try {
    await revokeRecordAccess(auth.user, (await params).id);
    return NextResponse.json({ status: "REVOKED", message: "Future access through this grant has stopped. Data already viewed cannot be recalled." });
  } catch (error) { return consentApiError(error); }
}
