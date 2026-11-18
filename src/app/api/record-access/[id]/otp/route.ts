import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { requestApprovalOtp } from "@/lib/record-access-requests";
import { consentApiError } from "@/lib/consent-api";
import { trustedRequestIp } from "@/lib/request-ip";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient", verifiedEmail: true });
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const result = await requestApprovalOtp(auth.user, id, await req.json(), trustedRequestIp(req));
    return NextResponse.json({ ...result, message: "Code request received. Use the code from your verified email within 10 minutes." }, { status: 202 });
  } catch (error) { return consentApiError(error); }
}
