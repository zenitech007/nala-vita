import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/auth";
import { approvalChoiceSchema, approveRecordAccess } from "@/lib/record-access-requests";
import { consentApiError } from "@/lib/consent-api";
import { trustedRequestIp } from "@/lib/request-ip";
const schema = approvalChoiceSchema.extend({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser({ roles: ["PATIENT"], profile: "patient", verifiedEmail: true });
  if (!auth.ok) return auth.response;
  try {
    const input = schema.parse(await req.json()), { id } = await params;
    const grant = await approveRecordAccess(auth.user, id, input, { ...input, ip: trustedRequestIp(req) });
    return NextResponse.json({ grant, message: "Scoped access approved. The source provider keeps its authored records." });
  } catch (error) { return consentApiError(error); }
}
