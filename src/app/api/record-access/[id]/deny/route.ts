import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { denyRecordAccess } from "@/lib/record-access-requests";
import { consentApiError } from "@/lib/consent-api";
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient" });
  if (!auth.ok) return auth.response;
  try { await denyRecordAccess(auth.user, (await params).id); return NextResponse.json({ status: "DENIED" }); }
  catch (error) { return consentApiError(error); }
}
